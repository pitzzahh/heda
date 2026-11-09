import { invoke } from '@tauri-apps/api/core';
import {
	BaseDirectory,
	exists,
	open as openFile,
	readFile,
	type ExistsOptions
} from '@tauri-apps/plugin-fs';
import {
	FileDeviceKeyError,
	FileLegacyError,
	FilePasswordError,
	decryptFilePayload,
	detectFileVersion,
	packFileV2,
	packFileV3
} from './format.js';
import {
	getSessionPassword,
	getSessionProtection,
	setSessionPassword,
	setSessionProtection,
	type FileProtection
} from '#lib/db/session.js';
import { getDeviceKey } from '#lib/helpers/security/device-key.js';
import { toast } from 'svelte-sonner';
import type { FileExport, RecentProject } from '#lib/types/main/index.js';
import { loadCurrentProject } from '#lib/db/mutations/index.js';
import { getAllChildNodes, getCurrentProject } from '#lib/db/queries/index.js';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { getLegacyV1Config } from './legacy/credentials.js';
import { isLegacyV1Envelope, legacyV1SaltCandidates } from './legacy/v1.js';
import { migrateLegacyFile } from './legacy/migration.js';
import { tauriMigrationFileIO } from './legacy/tauri-io.js';

export interface NeedPassword {
	need_password: true;
	file_path: string;
	invalid: boolean;
}

export interface NeedMigration {
	need_migration: true;
	file_path: string;
}

export const BASE_DIR = BaseDirectory.Document;
export const BASE_DIR_PATH = 'heda';
export const EXTENSION = 'heda';

export interface ParsedFileName {
	baseName: string;
	number: number | null;
	extension: string;
}

export function getFileNameWithoutExtension(path: string, extension: string = EXTENSION): string {
	const fileName = path.split('/').pop() || '';
	const lastDotIndex = fileName.lastIndexOf(`.${extension}`);
	return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
}

export function getFilePath(filePath: string): string {
	const parts = filePath.split('/');
	parts.pop();
	return parts.join('/');
}

/* Parses a filename into its components: base name, number(if any), and extension
 * @example
 * parseFileName("Untitled.heda") -> { baseName: "Untitled", number: null, extension: ".heda" }
 * parseFileName("Untitled (1).heda") -> { baseName: "Untitled", number: 1, extension: ".heda" }
 */

export async function getFileMetaData(path: string) {
	try {
		return await invoke('get_file_metadata', { path });
	} catch (err) {
		console.error(`Error reading file attributes: ${JSON.stringify(err)}`);
	}
}

export async function getFileName(path: string): Promise<string | undefined> {
	try {
		return await invoke('get_file_name', { path });
	} catch (err) {
		console.error(`Error fetching environment variable: ${JSON.stringify(err)}`);

		return undefined;
	}
}

export async function doesFileExists(
	path: string | URL,
	options?: ExistsOptions
): Promise<boolean> {
	try {
		return await exists(path, options);
	} catch (err) {
		console.error(`Error checking if file exists: ${JSON.stringify(err)}`);
		return false;
	}
}

export async function generateUniqueFileName(
	baseName: string,
	options?: ExistsOptions
): Promise<string> {
	let fileName = `${baseName}.${EXTENSION}`;
	let counter = 1;
	while (await doesFileExists(fileName, options)) {
		fileName = `${baseName}-(${counter}).${EXTENSION}`;
		counter++;
	}
	return fileName;
}

export async function writeEncryptedFile<T>(
	data: T,
	password: string,
	file_path: string,
	new_file: boolean = false
): Promise<void> {
	if (!file_path) {
		throw new Error('No file to write to');
	}
	// Truncate: without it a shorter save leaves a stale tail that corrupts the envelope.
	const file = await openFile(file_path, {
		write: true,
		create: true,
		createNew: new_file,
		truncate: true
	});
	await file.write(new TextEncoder().encode(await packFileV2(data, password)));
	await file.close();
}

// Device-encrypted (v3) write: sealed with this installation's key, so no
// password is needed to save or reopen. Same truncate guarantee as above.
export async function writeDeviceEncryptedFile<T>(
	data: T,
	device_key: string,
	file_path: string,
	new_file: boolean = false
): Promise<void> {
	if (!file_path) {
		throw new Error('No file to write to');
	}
	const file = await openFile(file_path, {
		write: true,
		create: true,
		createNew: new_file,
		truncate: true
	});
	await file.write(new TextEncoder().encode(await packFileV3(data, device_key)));
	await file.close();
}

export async function peekFileVersion(file_path: string): Promise<1 | 2 | 3> {
	return detectFileVersion(new TextDecoder().decode(await readFile(file_path)));
}

export async function readEncryptedFile<T>(
	filePath: string,
	password: string | null,
	device_key: string | null = null
): Promise<T> {
	const raw = new TextDecoder().decode(await readFile(filePath));
	return decryptFilePayload<T>(raw, password, device_key);
}

export async function handleLoadFile(
	complete_file_path?: string | null,
	_procesing?: () => void,
	_idle?: () => void,
	password: string | null = null
): Promise<RecentProject | NeedPassword | NeedMigration | undefined | string | number> {
	let load_toast_id: string | number | undefined;
	try {
		_procesing?.();

		if (!complete_file_path) {
			complete_file_path = await openDialog({
				multiple: false,
				directory: false,
				filters: [{ name: 'HEDA Files', extensions: ['heda'] }]
			});

			if (!complete_file_path) {
				_idle?.();
				return toast.warning('No file selected', {
					description: 'Cannot proceed, no file is selected.'
				});
			}
		}

		let version: 1 | 2 | 3 | null = null;
		try {
			version = await peekFileVersion(complete_file_path);
		} catch {
			version = null;
		}
		if (version === null) {
			_idle?.();
			return toast.warning('Failed to load file', {
				description: 'The file could not be read.'
			});
		}
		if (version === 1) {
			const raw = new TextDecoder().decode(await readFile(complete_file_path));
			if (!isLegacyV1Envelope(raw)) {
				_idle?.();
				return toast.warning('Failed to load file', {
					description: 'The file is not a valid HEDA file.'
				});
			}
			if (!getLegacyV1Config()) {
				_idle?.();
				return toast.warning('Legacy file cannot be upgraded', {
					description: 'This build does not include the legacy keys needed to open version 1 files.'
				});
			}
			_idle?.();
			return { need_migration: true, file_path: complete_file_path };
		}
		// Device-encrypted files open with this installation's key; only
		// password-protected files (shared copies) need a password.
		const protection: FileProtection = version === 3 ? 'device' : 'password';
		if (protection === 'password' && !password) {
			_idle?.();
			return { need_password: true, file_path: complete_file_path, invalid: false };
		}

		load_toast_id = toast.loading(`Loading file: ${complete_file_path}`, {
			description: 'Please wait while the file is being loaded.'
		});

		const device_key = protection === 'device' ? await getDeviceKey() : null;
		const file_data = await readEncryptedFile<FileExport>(complete_file_path, password, device_key);
		toast.dismiss(load_toast_id);

		const instance_name = await getFileName(complete_file_path);

		if (!instance_name) {
			console.error(`Failed to get file name of: ${complete_file_path}`);
			_idle?.();
			return toast.warning(`Failed to get file name of: ${complete_file_path}`, {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
		}

		// The secret is proven correct (or is the device key). Cache it before
		// the first db touch so the session store (Stronghold vault) unlocks.
		if (protection === 'device' && device_key) {
			setSessionPassword(device_key);
			setSessionProtection('device');
		} else {
			setSessionPassword(password!);
			setSessionProtection('password');
		}

		const loaded_project = await loadCurrentProject(file_data);

		return {
			id: loaded_project.id,
			project_name: instance_name,
			project_path: complete_file_path,
			exists: true,
			protection
		};
	} catch (err) {
		_idle?.();
		if (load_toast_id !== undefined) toast.dismiss(load_toast_id);
		if (err instanceof FilePasswordError) {
			return {
				need_password: true,
				file_path: complete_file_path ?? '',
				invalid: err.code === 'invalid'
			};
		}
		if (err instanceof FileDeviceKeyError) {
			return toast.warning('File was encrypted on another device', {
				description:
					"This .heda file uses this device's key and cannot be opened here. Open it on the device that created it, or ask the owner for a password-protected copy."
			});
		}
		if (err instanceof FileLegacyError) {
			return toast.warning('Legacy file needs an upgrade', {
				description: 'Open it from the home page to upgrade it.'
			});
		}
		console.error(`Failed to load file: ${JSON.stringify(err, null, 2)}`);
		toast.error(`Failed to load file: ${(err as Error)?.message ?? 'something went wrong'}`, {
			description: 'This is a system error and should not be here, the error has been logged.'
		});
	}
}

export interface MigrateHedaFileResult {
	backup_path: string;
}

/**
 * Upgrades one legacy v1 file to the device-encrypted v3 format, or to the
 * password-protected v2 format when `new_password` is given. The original
 * bytes are kept as a verified `.v1.bak` next to the file.
 */
export async function migrateHedaFile(
	file_path: string,
	new_password?: string
): Promise<MigrateHedaFileResult> {
	const config = getLegacyV1Config();
	if (!config) {
		throw new Error('This build does not include the legacy keys needed to open version 1 files.');
	}
	if (new_password !== undefined && new_password.length < 8) {
		throw new Error('The new file password must be at least 8 characters.');
	}
	const device_key = new_password === undefined ? await getDeviceKey() : null;

	const result = await migrateLegacyFile<FileExport>({
		file_path,
		...(new_password !== undefined ? { new_password } : { device_key: device_key! }),
		legacy: {
			passphrase: config.passphrase,
			salts: legacyV1SaltCandidates(file_path, config.salt)
		},
		io: tauriMigrationFileIO()
	});
	return { backup_path: result.backup_path };
}

/**
 * Re-encrypts a password-protected v2 file with this device's key, so it
 * opens without a password from now on. The original is kept as a verified
 * `.v2.bak` next to the file.
 */
export async function convertHedaFileToDevice(
	file_path: string,
	password: string
): Promise<MigrateHedaFileResult> {
	const io = tauriMigrationFileIO();
	const original = await io.read(file_path);
	const raw = new TextDecoder().decode(original);
	if (detectFileVersion(raw) !== 2) {
		throw new Error('Only a password-protected file can be converted to device encryption.');
	}
	const data = await decryptFilePayload<FileExport>(raw, password);
	const device_key = await getDeviceKey();
	const staged = new TextEncoder().encode(await packFileV3(data, device_key));
	const temp_path = `${file_path}.v3.tmp`;

	await io.write(temp_path, staged);
	const staged_check = await decryptFilePayload<FileExport>(
		new TextDecoder().decode(await io.read(temp_path)),
		null,
		device_key
	);
	if (JSON.stringify(staged_check) !== JSON.stringify(data)) {
		await io.remove(temp_path);
		throw new Error('The converted file did not pass verification.');
	}

	let backup_path = `${file_path}.v2.bak`;
	for (let suffix = 1; (await io.exists(backup_path)) && suffix < 10_000; suffix++) {
		backup_path = `${file_path}.v2.bak.${suffix}`;
	}
	const bytes_equal = (a: Uint8Array, b: Uint8Array): boolean => {
		if (a.length !== b.length) return false;
		let difference = 0;
		for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
		return difference === 0;
	};
	await io.write(backup_path, original);
	const backup_check = await io.read(backup_path);
	if (!bytes_equal(backup_check, original)) {
		await io.remove(temp_path);
		throw new Error('A verified backup of the original file could not be created.');
	}

	try {
		await io.write(file_path, staged);
		const committed = await io.read(file_path);
		if (!bytes_equal(committed, staged)) throw new Error('The written file does not match.');
		await decryptFilePayload<FileExport>(new TextDecoder().decode(committed), null, device_key);
	} catch (err) {
		await io.write(file_path, original);
		await io.remove(temp_path);
		throw err;
	}
	await io.remove(temp_path).catch(() => undefined);
	return { backup_path };
}

// Serializes writes: auto-save, Ctrl+S and the OS file-open flow can overlap.
let save_queue: Promise<unknown> = Promise.resolve();

/**
 * Writes the current project to `file_path` and clears the unsaved flag on
 * success. Returns whether the save went through; failures surface as toasts.
 */
export function saveCurrentProject(
	file_path: string,
	undo_redo_state: { resetUnsavedActions: () => void }
): Promise<boolean> {
	const run = save_queue.then(() => performSave(file_path, undo_redo_state));
	save_queue = run.catch(() => undefined);
	return run;
}

async function performSave(
	file_path: string,
	undo_redo_state: { resetUnsavedActions: () => void }
): Promise<boolean> {
	try {
		const current_project = getCurrentProject();

		if (!current_project) {
			console.error('Failed to save, no project found');
			toast.warning('Failed to save, no project found', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return false;
		}

		const file_data: FileExport = {
			project: current_project,
			nodes: getAllChildNodes(current_project.root_node_id, true)
		};

		const protection = getSessionProtection();
		if (protection === 'device') {
			await writeDeviceEncryptedFile(file_data, await getDeviceKey(), file_path);
		} else {
			const session_password = getSessionPassword();
			if (!session_password) {
				console.error('Failed to save, no session password');
				toast.warning('Failed to save, no session password', {
					description: 'Reload the file and try again.'
				});
				return false;
			}
			await writeEncryptedFile(file_data, session_password, file_path);
		}
		undo_redo_state.resetUnsavedActions();
		return true;
	} catch (err) {
		console.error(`Failed to save file: ${JSON.stringify(err)}`);
		toast.error(`Failed to save file: ${(err as Error)?.message ?? 'something went wrong'}`, {
			description: 'An error occurred while saving the file.'
		});
		return false;
	}
}
