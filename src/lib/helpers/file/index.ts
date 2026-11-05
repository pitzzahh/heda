import { invoke } from '@tauri-apps/api/core';
import {
	BaseDirectory,
	exists,
	open as openFile,
	readFile,
	type ExistsOptions
} from '@tauri-apps/plugin-fs';
import {
	FileLegacyError,
	FilePasswordError,
	decryptFilePayload,
	detectFileVersion,
	packFileV2
} from './format';
import { setSessionPassword } from '#lib/db/session';
import { toast } from 'svelte-sonner';
import type { FileExport, RecentProject } from '#lib/types/main';
import { loadCurrentProject } from '#lib/db/mutations';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

export interface NeedPassword {
	need_password: true;
	file_path: string;
	invalid: boolean;
}

export const BASE_DIR = BaseDirectory.Document;
export const BASE_DIR_PATH = 'heda';
export const EXTENSION = 'heda';

export interface ParsedFileName {
	baseName: string;
	number: number | null;
	extension: string;
}

/**
 * Gets the file name without the extension
 * @param path - The full path of the file
 * @param extension - The extension to remove
 * @returns The file name without the extension
 */
export function getFileNameWithoutExtension(path: string, extension: string = EXTENSION): string {
	const fileName = path.split('/').pop() || '';
	const lastDotIndex = fileName.lastIndexOf(`.${extension}`);
	return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
}

/**
 * A helper function to get the path of a file.
 * @param filePath the absolute file path.
 * @returns the path of the file.
 */
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
	const file = await openFile(file_path, { write: true, create: true, createNew: new_file });
	await file.write(new TextEncoder().encode(await packFileV2(data, password)));
	await file.close();
}

export async function peekFileVersion(file_path: string): Promise<1 | 2> {
	return detectFileVersion(new TextDecoder().decode(await readFile(file_path)));
}

export async function readEncryptedFile<T>(filePath: string, password: string | null): Promise<T> {
	const raw = new TextDecoder().decode(await readFile(filePath));
	console.log('File read successfully!');
	return decryptFilePayload<T>(raw, password);
}

export async function handleLoadFile(
	complete_file_path?: string | null,
	_procesing?: () => void,
	_idle?: () => void,
	password: string | null = null
): Promise<RecentProject | NeedPassword | undefined | string | number> {
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

		let version: 1 | 2 | null = null;
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
			_idle?.();
			return toast.warning('Unsupported file format', {
				description: 'This file uses the legacy v1 format, which is no longer supported.'
			});
		}
		if (version === 2 && !password) {
			_idle?.();
			return { need_password: true, file_path: complete_file_path, invalid: false };
		}

		load_toast_id = toast.loading(`Loading file: ${complete_file_path}`, {
			description: 'Please wait while the file is being loaded.'
		});

		const file_data = await readEncryptedFile<FileExport>(complete_file_path, password);
		toast.dismiss(load_toast_id);

		const instance_name = await getFileName(complete_file_path);

		if (!instance_name) {
			console.error(`Failed to get file name of: ${complete_file_path}`);
			_idle?.();
			return toast.warning(`Failed to get file name of: ${complete_file_path}`, {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
		}

		console.log(`Loaded data: ${JSON.stringify(file_data, null, 2)}`);
		console.log(`Complete file path: ${complete_file_path}`);
		console.log(`File name: ${instance_name}`);

		// Password proven correct. Cache it before the first db touch so the
		// session store (Stronghold vault) unlocks with this file's secret.
		setSessionPassword(password!);

		const loaded_project = await loadCurrentProject(file_data);

		console.log(`Loaded project: ${JSON.stringify(loaded_project, null, 2)}`);

		return {
			id: loaded_project.id,
			project_name: instance_name,
			project_path: complete_file_path,
			exists: true
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
		if (err instanceof FileLegacyError) {
			return toast.warning('Unsupported file format', {
				description: 'This file uses the legacy v1 format, which is no longer supported.'
			});
		}
		console.error(`Failed to load file: ${JSON.stringify(err, null, 2)}`);
		toast.error(`Failed to load file: ${(err as Error)?.message ?? 'something went wrong'}`, {
			description: 'This is a system error and should not be here, the error has been logged.'
		});
	}
}
