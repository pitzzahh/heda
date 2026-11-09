import { describe, expect, it } from 'vitest';
import { decryptFilePayload } from '../format.js';
import {
	LEGACY_V1_FIXTURE_FIXED_SALT,
	LEGACY_V1_FIXTURE_PASSPHRASE,
	LEGACY_V1_FIXTURE_PAYLOAD,
	LEGACY_V1_PLAIN_FIXED
} from './fixtures.js';
import {
	LegacyMigrationError,
	LegacyMigrationRestoreError,
	legacyBackupPath,
	legacyMigrationTempPath,
	migrateLegacyFile,
	uniqueLegacyBackupPath,
	type MigrationFileIO
} from './migration.js';

const DEVICE_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const FILE_PATH = '/tmp/Legacy Project.heda';
const NEW_PASSWORD = 'new-file-password';
const TEMP_PATH = legacyMigrationTempPath(FILE_PATH);
const BACKUP_PATH = legacyBackupPath(FILE_PATH);

type Operation = 'read' | 'write' | 'exists' | 'remove';

interface Rule {
	op: Operation;
	path: string;
	action: 'fail' | 'corrupt';
	skip?: number;
	count?: number;
}

class MemoryIO implements MigrationFileIO {
	files = new Map<string, Uint8Array>();
	write_attempts: string[] = [];
	writes: string[] = [];
	private rules: Rule[];

	constructor(entries: Record<string, string> = {}, rules: Rule[] = []) {
		for (const [path, value] of Object.entries(entries)) {
			this.files.set(path, new TextEncoder().encode(value));
		}
		this.rules = rules;
	}

	bytes(path: string): string {
		return new TextDecoder().decode(this.files.get(path));
	}

	private take(op: Operation, path: string, action: Rule['action']): boolean {
		const rule = this.rules.find(
			(candidate) =>
				candidate.op === op &&
				candidate.path === path &&
				candidate.action === action &&
				(candidate.count ?? 1) > 0
		);
		if (!rule) return false;
		if ((rule.skip ?? 0) > 0) {
			rule.skip = (rule.skip ?? 0) - 1;
			return false;
		}
		rule.count = (rule.count ?? 1) - 1;
		return true;
	}

	async read(path: string): Promise<Uint8Array> {
		if (this.take('read', path, 'fail')) throw new Error('read failed');
		const bytes = this.files.get(path);
		if (!bytes) throw new Error(`ENOENT: ${path}`);
		const copy = bytes.slice();
		if (this.take('read', path, 'corrupt')) copy[0] ^= 0xff;
		return copy;
	}

	async write(path: string, bytes: Uint8Array): Promise<void> {
		this.write_attempts.push(path);
		if (this.take('write', path, 'fail')) throw new Error('write failed');
		this.writes.push(path);
		this.files.set(path, bytes.slice());
	}

	async exists(path: string): Promise<boolean> {
		if (this.take('exists', path, 'fail')) throw new Error('exists failed');
		return this.files.has(path);
	}

	async remove(path: string): Promise<void> {
		if (this.take('remove', path, 'fail')) throw new Error('remove failed');
		this.files.delete(path);
	}
}

function createIO(rules: Rule[] = []): MemoryIO {
	return new MemoryIO({ [FILE_PATH]: LEGACY_V1_PLAIN_FIXED }, rules);
}

function migrate(io: MemoryIO) {
	return migrateLegacyFile<typeof LEGACY_V1_FIXTURE_PAYLOAD>({
		file_path: FILE_PATH,
		new_password: NEW_PASSWORD,
		legacy: {
			passphrase: LEGACY_V1_FIXTURE_PASSPHRASE,
			salts: [LEGACY_V1_FIXTURE_FIXED_SALT]
		},
		io
	});
}

describe('legacy v1 migration', () => {
	it('stages, backs up and commits a verifiable v2 file', async () => {
		const io = createIO();
		const result = await migrate(io);

		expect(result.data).toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
		expect(result.backup_path).toBe(BACKUP_PATH);
		expect(result.legacy_salt).toBe(LEGACY_V1_FIXTURE_FIXED_SALT);
		expect(io.writes).toEqual([TEMP_PATH, BACKUP_PATH, FILE_PATH]);
		expect(io.files.has(TEMP_PATH)).toBe(false);
		expect(io.bytes(BACKUP_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		await expect(decryptFilePayload(io.bytes(FILE_PATH), NEW_PASSWORD)).resolves.toEqual(
			LEGACY_V1_FIXTURE_PAYLOAD
		);
	});

	it('migrates to device encryption with a device key', async () => {
		const io = createIO();
		const temp_path = legacyMigrationTempPath(FILE_PATH, 3);
		const result = await migrateLegacyFile<typeof LEGACY_V1_FIXTURE_PAYLOAD>({
			file_path: FILE_PATH,
			device_key: DEVICE_KEY,
			legacy: {
				passphrase: LEGACY_V1_FIXTURE_PASSPHRASE,
				salts: [LEGACY_V1_FIXTURE_FIXED_SALT]
			},
			io
		});

		expect(result.backup_path).toBe(BACKUP_PATH);
		expect(io.writes).toEqual([temp_path, BACKUP_PATH, FILE_PATH]);
		expect(io.files.has(temp_path)).toBe(false);
		await expect(decryptFilePayload(io.bytes(FILE_PATH), null, DEVICE_KEY)).resolves.toEqual(
			LEGACY_V1_FIXTURE_PAYLOAD
		);
	});

	it('keeps the original safe when decryption fails', async () => {
		const io = new MemoryIO({ [FILE_PATH]: LEGACY_V1_PLAIN_FIXED });
		const err = (await migrateLegacyFile({
			file_path: FILE_PATH,
			new_password: NEW_PASSWORD,
			legacy: { passphrase: 'wrong-passphrase', salts: [LEGACY_V1_FIXTURE_FIXED_SALT] },
			io
		}).catch((e) => e)) as LegacyMigrationError;

		expect(err).toBeInstanceOf(LegacyMigrationError);
		expect(err.step).toBe('decrypt');
		expect(io.bytes(FILE_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.writes).toEqual([]);
	});

	it('reports an unreadable original', async () => {
		const io = new MemoryIO();
		await expect(migrate(io)).rejects.toMatchObject({ step: 'read' });
	});

	it('discards the stage when writing it fails', async () => {
		const io = createIO([{ op: 'write', path: TEMP_PATH, action: 'fail' }]);
		await expect(migrate(io)).rejects.toMatchObject({ step: 'stage' });
		expect(io.bytes(FILE_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.files.has(TEMP_PATH)).toBe(false);
		expect(io.files.has(BACKUP_PATH)).toBe(false);
	});

	it('discards a stage that does not verify', async () => {
		const io = createIO([{ op: 'read', path: TEMP_PATH, action: 'corrupt' }]);
		await expect(migrate(io)).rejects.toMatchObject({ step: 'verify_stage' });
		expect(io.bytes(FILE_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.files.has(TEMP_PATH)).toBe(false);
		expect(io.files.has(BACKUP_PATH)).toBe(false);
	});

	it('discards a backup that does not match the original', async () => {
		const io = createIO([{ op: 'read', path: BACKUP_PATH, action: 'corrupt' }]);
		await expect(migrate(io)).rejects.toMatchObject({ step: 'backup' });
		expect(io.bytes(FILE_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.files.has(TEMP_PATH)).toBe(false);
		expect(io.files.has(BACKUP_PATH)).toBe(false);
	});

	it('uses a numbered backup name when one already exists', async () => {
		const io = createIO();
		io.files.set(BACKUP_PATH, new TextEncoder().encode('older backup'));
		const result = await migrate(io);

		expect(result.backup_path).toBe(`${BACKUP_PATH}.1`);
		expect(io.bytes(BACKUP_PATH)).toBe('older backup');
		expect(io.bytes(`${BACKUP_PATH}.1`)).toBe(LEGACY_V1_PLAIN_FIXED);
	});

	it('restores the original when the commit write fails', async () => {
		const io = createIO([{ op: 'write', path: FILE_PATH, action: 'fail' }]);
		const err = (await migrate(io).catch((e) => e)) as LegacyMigrationError;

		expect(err).toBeInstanceOf(LegacyMigrationError);
		expect(err.step).toBe('commit');
		expect(io.bytes(FILE_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.bytes(BACKUP_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.files.has(TEMP_PATH)).toBe(false);
	});

	it('restores the original when the committed file does not verify', async () => {
		const io = createIO([{ op: 'read', path: FILE_PATH, action: 'corrupt', skip: 1, count: 1 }]);
		await expect(migrate(io)).rejects.toMatchObject({ step: 'commit' });
		expect(io.bytes(FILE_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.bytes(BACKUP_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.files.has(TEMP_PATH)).toBe(false);
	});

	it('reports the backup path when the restore itself fails', async () => {
		const io = createIO([
			{ op: 'read', path: FILE_PATH, action: 'corrupt', skip: 1, count: 1 },
			{ op: 'write', path: FILE_PATH, action: 'fail', skip: 1, count: 1 }
		]);
		const err = (await migrate(io).catch((e) => e)) as LegacyMigrationRestoreError;

		expect(err).toBeInstanceOf(LegacyMigrationRestoreError);
		expect(err.step).toBe('restore');
		expect(err.backup_path).toBe(BACKUP_PATH);
		expect(err.migration_error.step).toBe('commit');
		expect(io.bytes(BACKUP_PATH)).toBe(LEGACY_V1_PLAIN_FIXED);
		expect(io.files.has(TEMP_PATH)).toBe(true);
	});

	it('finds the first free numbered backup path', async () => {
		const io = createIO();
		io.files.set(BACKUP_PATH, new TextEncoder().encode('one'));
		io.files.set(`${BACKUP_PATH}.1`, new TextEncoder().encode('two'));
		await expect(uniqueLegacyBackupPath(FILE_PATH, io)).resolves.toBe(`${BACKUP_PATH}.2`);
	});
});
