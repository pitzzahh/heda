// One-time v1 to v2/v3 migration. The original file is only replaced after a
// staged envelope and a byte-for-byte backup have been verified.
import { decryptFilePayload, detectFileVersion, packFileV2, packFileV3 } from '../format.js';
import {
	decryptLegacyV1,
	LegacyV1Error,
	type LegacyV1Credentials,
	type LegacyV1Result
} from './v1.js';

export interface MigrationFileIO {
	read(path: string): Promise<Uint8Array>;
	write(path: string, bytes: Uint8Array): Promise<void>;
	exists(path: string): Promise<boolean>;
	remove(path: string): Promise<void>;
}

export type LegacyMigrationStep =
	'read' | 'decrypt' | 'stage' | 'verify_stage' | 'backup' | 'commit' | 'restore';

export class LegacyMigrationError extends Error {
	step: LegacyMigrationStep;
	original_error: unknown;
	backup_path: string | null;

	constructor(
		step: LegacyMigrationStep,
		message: string,
		original_error: unknown,
		backup_path: string | null = null
	) {
		super(message);
		this.step = step;
		this.original_error = original_error;
		this.backup_path = backup_path;
	}
}

export class LegacyMigrationRestoreError extends LegacyMigrationError {
	migration_error: LegacyMigrationError;

	constructor(backup_path: string, migration_error: LegacyMigrationError, restore_error: unknown) {
		super(
			'restore',
			`Migration failed and the original file could not be restored. A backup is available at ${backup_path}.`,
			restore_error,
			backup_path
		);
		this.migration_error = migration_error;
	}
}

export interface LegacyMigrationOptions {
	file_path: string;
	/** Password-protected output (v2). Mutually exclusive with `device_key`. */
	new_password?: string;
	/** Device-encrypted output (v3). Mutually exclusive with `new_password`. */
	device_key?: string;
	legacy: LegacyV1Credentials;
	io: MigrationFileIO;
}

export interface LegacyMigrationResult<T> {
	data: T;
	backup_path: string;
	legacy_salt: string;
}

export function legacyMigrationTempPath(file_path: string, target_version: 2 | 3 = 2): string {
	return `${file_path}.v${target_version}.tmp`;
}

export function legacyBackupPath(file_path: string): string {
	return `${file_path}.v1.bak`;
}

export function uniqueLegacyBackupPath(file_path: string, io: MigrationFileIO): Promise<string> {
	return uniqueBackupPath(legacyBackupPath(file_path), io);
}

/** `base`, else the first free `base.N`. */
async function uniqueBackupPath(base: string, io: MigrationFileIO): Promise<string> {
	if (!(await io.exists(base))) return base;
	for (let suffix = 1; suffix < 10_000; suffix++) {
		const candidate = `${base}.${suffix}`;
		if (!(await io.exists(candidate))) return candidate;
	}
	throw new LegacyMigrationError(
		'backup',
		'No free backup file name could be found next to the original file.',
		undefined
	);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
	return difference === 0;
}

function decodeText(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes);
}

async function verifyStagedPayload(
	bytes: Uint8Array,
	decrypt: (raw: string) => Promise<unknown>,
	expected: unknown,
	target_version: 2 | 3
): Promise<void> {
	const raw = decodeText(bytes);
	if (detectFileVersion(raw) !== target_version) {
		throw new Error(`The staged file is not a v${target_version} envelope.`);
	}
	const actual = await decrypt(raw);
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error('The staged payload does not match the legacy payload.');
	}
}

async function discard(io: MigrationFileIO, path: string): Promise<void> {
	try {
		await io.remove(path);
	} catch {
		// Cleanup is best effort; the original file is still untouched.
	}
}

async function restoreOriginal(
	io: MigrationFileIO,
	file_path: string,
	original: Uint8Array,
	migration_error: LegacyMigrationError
): Promise<void> {
	try {
		await io.write(file_path, original);
		if (!bytesEqual(await io.read(file_path), original)) {
			throw new Error('The restored file does not match the original.');
		}
	} catch (restore_error) {
		throw new LegacyMigrationRestoreError(
			migration_error.backup_path ?? legacyBackupPath(file_path),
			migration_error,
			restore_error
		);
	}
}

export async function migrateLegacyFile<T>(
	options: LegacyMigrationOptions
): Promise<LegacyMigrationResult<T>> {
	const { file_path, new_password, device_key, legacy, io } = options;
	const target_version: 2 | 3 = device_key ? 3 : 2;

	let original: Uint8Array;
	try {
		original = await io.read(file_path);
	} catch (err) {
		throw new LegacyMigrationError('read', 'The legacy file could not be read.', err);
	}

	let decoded: LegacyV1Result<T>;
	try {
		decoded = await decryptLegacyV1<T>(decodeText(original), legacy);
	} catch (err) {
		throw new LegacyMigrationError(
			'decrypt',
			err instanceof LegacyV1Error ? err.message : 'The legacy file could not be opened.',
			err
		);
	}

	const backup_path = await replaceVerified({
		file_path,
		original,
		data: decoded.data,
		target_version,
		secret: target_version === 3 ? (device_key ?? '') : (new_password ?? ''),
		backup_base: legacyBackupPath(file_path),
		io
	});
	return { data: decoded.data, backup_path, legacy_salt: decoded.salt };
}

export interface DeviceConversionOptions {
	file_path: string;
	/** The password the v2 file is sealed with. */
	password: string;
	device_key: string;
	io: MigrationFileIO;
}

/**
 * Re-seals a password-protected v2 file with the device key (v3), with the same
 * staged, verified replace as the legacy migration; the original is kept as a
 * verified `.v2.bak`. A wrong password throws `FilePasswordError` before anything
 * is written.
 */
export async function convertV2ToDevice<T>(
	options: DeviceConversionOptions
): Promise<{ data: T; backup_path: string }> {
	const { file_path, password, device_key, io } = options;
	let original: Uint8Array;
	try {
		original = await io.read(file_path);
	} catch (err) {
		throw new LegacyMigrationError('read', 'The file could not be read.', err);
	}
	const raw = decodeText(original);
	if (detectFileVersion(raw) !== 2) {
		throw new Error('Only a password-protected file can be converted to device encryption.');
	}
	const data = await decryptFilePayload<T>(raw, password, null, 2);
	const backup_path = await replaceVerified({
		file_path,
		original,
		data,
		target_version: 3,
		secret: device_key,
		backup_base: `${file_path}.v2.bak`,
		io
	});
	return { data, backup_path };
}

interface ReplaceOptions<T> {
	file_path: string;
	original: Uint8Array;
	data: T;
	target_version: 2 | 3;
	/** The new file password (v2) or the device key (v3). */
	secret: string;
	backup_base: string;
	io: MigrationFileIO;
}

/**
 * Replaces `file_path` with `data` sealed as `target_version`, only after a staged
 * copy and a byte-for-byte backup of `original` are verified; a failed commit
 * restores the original. Answers the backup's path.
 */
async function replaceVerified<T>(options: ReplaceOptions<T>): Promise<string> {
	const { file_path, original, data, target_version, secret, backup_base, io } = options;
	const verify = (raw: string) =>
		target_version === 3
			? decryptFilePayload<unknown>(raw, null, secret)
			: decryptFilePayload<unknown>(raw, secret);

	let staged: Uint8Array;
	try {
		staged = new TextEncoder().encode(
			target_version === 3 ? await packFileV3(data, secret) : await packFileV2(data, secret)
		);
	} catch (err) {
		throw new LegacyMigrationError('stage', 'The upgraded file could not be prepared.', err);
	}
	const temp_path = legacyMigrationTempPath(file_path, target_version);

	try {
		await io.write(temp_path, staged);
	} catch (err) {
		await discard(io, temp_path);
		throw new LegacyMigrationError('stage', 'The upgraded file could not be staged.', err);
	}

	try {
		await verifyStagedPayload(await io.read(temp_path), verify, data, target_version);
	} catch (err) {
		await discard(io, temp_path);
		throw new LegacyMigrationError(
			'verify_stage',
			'The staged file did not pass verification.',
			err
		);
	}

	let backup_path: string | null = null;
	try {
		backup_path = await uniqueBackupPath(backup_base, io);
		await io.write(backup_path, original);
		if (!bytesEqual(await io.read(backup_path), original)) {
			throw new Error('The backup does not match the original file.');
		}
	} catch (err) {
		await discard(io, temp_path);
		if (backup_path) await discard(io, backup_path);
		throw new LegacyMigrationError(
			'backup',
			'A verified backup of the original file could not be created.',
			err,
			backup_path
		);
	}

	try {
		await io.write(file_path, staged);
		const committed = await io.read(file_path);
		if (!bytesEqual(committed, staged)) {
			throw new Error('The written file does not match the staged file.');
		}
		await verifyStagedPayload(committed, verify, data, target_version);
	} catch (err) {
		const migration_error = new LegacyMigrationError(
			'commit',
			'The file could not be replaced; the original has been restored.',
			err,
			backup_path
		);
		await restoreOriginal(io, file_path, original, migration_error);
		await discard(io, temp_path);
		throw migration_error;
	}

	// The new file is committed; a leftover copy is only cosmetic.
	await discard(io, temp_path);
	return backup_path;
}
