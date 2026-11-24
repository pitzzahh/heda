import { invoke } from '@tauri-apps/api/core';
import {
	exists,
	open as openFile,
	readFile,
	rename,
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
	clearSessionPassword,
	getSessionPassword,
	getSessionProtection,
	setSession,
	type FileProtection
} from '#lib/db/session.js';
import { getDeviceKey } from '#lib/helpers/security/device-key.js';
import { toast } from 'svelte-sonner';
import type { FileExport, RecentProject } from '#lib/types/main.js';
import { loadCurrentProject } from '#lib/db/mutations/index.js';
import { getAllChildNodes, getCurrentProject } from '#lib/db/queries/index.js';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { getLegacyV1Config } from './legacy/credentials.js';
import { isLegacyV1Envelope, legacyV1SaltCandidates } from './legacy/v1.js';
import { convertV2ToDevice, migrateLegacyFile } from './legacy/migration.js';
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

export const EXTENSION = 'heda';

export async function getFileName(path: string): Promise<string | undefined> {
	try {
		return await invoke('get_file_name', { path });
	} catch (err) {
		console.error(`Error reading the file name: ${JSON.stringify(err)}`);

		return undefined;
	}
}

/**
 * Lets the fs plugin reach the folder of an existing `.heda` file (the file and
 * the temp/backup files written next to it). The capability grants no user
 * folders, so call this before touching a project path outside a dialog.
 * Resolves `false` when the file does not exist.
 */
export async function allowProjectFolder(path: string): Promise<boolean> {
	return invoke<boolean>('allow_project_folder', { path });
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

/**
 * A new file is created exclusively (also a `content://` document, which cannot be
 * renamed). An existing one is replaced through `<path>.tmp` and a rename, so a write
 * cut off by a crash, a killed app or a full disk leaves the old file whole.
 */
async function writeSealed(envelope: string, file_path: string, new_file: boolean): Promise<void> {
	if (!file_path) {
		throw new Error('No file to write to');
	}
	const target = new_file ? file_path : `${file_path}.tmp`;
	// Truncate: a temp file left by a crashed save must not keep a stale tail.
	const file = await openFile(target, {
		write: true,
		create: true,
		createNew: new_file,
		truncate: true
	});
	try {
		await file.write(new TextEncoder().encode(envelope));
	} finally {
		await file.close();
	}
	// shortcut: no fsync (the fs plugin has none), so power loss right after a save can still lose it.
	if (!new_file) await rename(target, file_path);
}

export async function writeEncryptedFile<T>(
	data: T,
	password: string,
	file_path: string,
	new_file: boolean = false
): Promise<void> {
	await writeSealed(await packFileV2(data, password), file_path, new_file);
}

// Device-encrypted (v3) write: sealed with this installation's key, so no
// password is needed to save or reopen.
export async function writeDeviceEncryptedFile<T>(
	data: T,
	device_key: string,
	file_path: string,
	new_file: boolean = false
): Promise<void> {
	await writeSealed(await packFileV3(data, device_key), file_path, new_file);
}

export async function handleLoadFile(
	complete_file_path?: string | null,
	_procesing?: () => void,
	_idle?: () => void,
	password: string | null = null
): Promise<
	| (RecentProject & { pec_2017_migrated: boolean })
	| NeedPassword
	| NeedMigration
	| undefined
	| string
	| number
> {
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

		// Read and decode once: version detection, legacy checks and decryption
		// all work on the same string.
		let raw: string;
		try {
			await allowProjectFolder(complete_file_path);
			raw = new TextDecoder().decode(await readFile(complete_file_path));
		} catch {
			_idle?.();
			return toast.warning('Failed to load file', {
				description: 'The file could not be read.'
			});
		}
		const version = detectFileVersion(raw);
		if (version === 1) {
			if (!(await isLegacyV1Envelope(raw))) {
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
		const file_data = await decryptFilePayload<FileExport>(raw, password, device_key, version);
		toast.dismiss(load_toast_id);

		const instance_name = await getFileName(complete_file_path);

		if (!instance_name) {
			console.error(`Failed to get file name of: ${complete_file_path}`);
			_idle?.();
			return toast.warning(`Failed to get file name of: ${complete_file_path}`, {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
		}

		// The secret is proven correct (or is the device key). Cache it now: a
		// webview reload restores the session only while it is set.
		if (protection === 'device' && device_key) {
			setSession(device_key, 'device');
		} else {
			setSession(password!, 'password');
		}

		let loaded;
		try {
			loaded = await loadCurrentProject(file_data);
		} catch (err) {
			// A rejected file (corrupt or tampered contents) opens nothing, so its
			// secret must not stay cached in memory or the tab's session mirror.
			clearSessionPassword();
			throw err;
		}

		return {
			id: loaded.project.id,
			project_name: instance_name,
			project_path: complete_file_path,
			exists: true,
			protection,
			pec_2017_migrated: loaded.pec_2017_migrated
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
	const { backup_path } = await convertV2ToDevice<FileExport>({
		file_path,
		password,
		device_key: await getDeviceKey(),
		io: tauriMigrationFileIO()
	});
	return { backup_path };
}

// Serializes writes: auto-save, Ctrl+S and the OS file-open flow can overlap.
let save_queue: Promise<unknown> = Promise.resolve();

/**
 * Writes the current project to `file_path` and clears the unsaved flag on
 * success. Returns whether the save went through; failures surface as toasts.
 *
 * The project and its nodes are snapshotted here, not when the queued save
 * runs: the user can go Home (which clears the database) or load another file
 * while an earlier save is still in flight, and reading the current project at
 * execution time would write the wrong data to `file_path`.
 */
export function saveCurrentProject(
	file_path: string,
	undo_redo_state: { edit_version: number; resetUnsavedActions: (saved_version: number) => void }
): Promise<boolean> {
	const current_project = getCurrentProject();

	if (!current_project) {
		console.error('Failed to save, no project found');
		toast.warning('Failed to save, no project found', {
			description: 'This is a system error and should not be here, the error has been logged.'
		});
		return Promise.resolve(false);
	}

	const file_data: FileExport = {
		project: current_project,
		nodes: getAllChildNodes(current_project.root_node_id, true)
	};
	const project_id = current_project.id;
	// Edits made while this save is queued or writing are not in `file_data`.
	const edit_version = undo_redo_state.edit_version;

	const run = save_queue.then(() =>
		performSave(file_path, project_id, file_data, edit_version, undo_redo_state)
	);
	save_queue = run.catch(() => undefined);
	return run;
}

async function performSave(
	file_path: string,
	project_id: string,
	file_data: FileExport,
	edit_version: number,
	undo_redo_state: { edit_version: number; resetUnsavedActions: (saved_version: number) => void }
): Promise<boolean> {
	try {
		// The workspace moved on while this save was queued (Home, another
		// file). Writing now would clobber the new state, so drop it.
		if (getCurrentProject()?.id !== project_id) return false;

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
		// Re-check before clearing: a project loaded while the write was in
		// flight must keep its own unsaved flag.
		if (getCurrentProject()?.id !== project_id) return false;
		undo_redo_state.resetUnsavedActions(edit_version);
		return true;
	} catch (err) {
		console.error(`Failed to save file: ${JSON.stringify(err)}`);
		toast.error(`Failed to save file: ${(err as Error)?.message ?? 'something went wrong'}`, {
			description: 'An error occurred while saving the file.'
		});
		return false;
	}
}
