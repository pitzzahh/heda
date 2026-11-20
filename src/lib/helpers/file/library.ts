// The Android app keeps its projects in a folder of its own
// (`<app local data>/projects`). Files from the system file picker are
// `content://` documents: no folder to write backups into, a name only the
// provider knows, and write access that is not guaranteed and lapses on
// restart. So they are imported (copied) into the folder, and copies leave it
// through the save dialog. Real paths keep the desktop save, backup and
// conversion code working unchanged.
import { invoke } from '@tauri-apps/api/core';
import { appLocalDataDir } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { mkdir, open, readDir, remove, stat, writeFile } from '@tauri-apps/plugin-fs';
import type { LibraryProject } from '#lib/types/main.js';
import { getDeviceKey } from '#lib/helpers/security/device-key.js';
import { EXTENSION } from './index.js';
import {
	FileDeviceKeyError,
	FilePasswordError,
	decryptFilePayload,
	detectFileVersion
} from './format.js';
import { getLegacyV1Config } from './legacy/credentials.js';
import { isLegacyV1Envelope, legacyV1SaltCandidates } from './legacy/v1.js';
import { migrateLegacyFile, type MigrationFileIO } from './legacy/migration.js';

export const LIBRARY_FOLDER = 'projects';
/** Far above any real project (a few MB); stops a mis-picked video from filling memory. */
export const IMPORT_SIZE_LIMIT = 64 * 1024 * 1024;
export const UNTITLED_PROJECT_NAME = 'Untitled project';
export const IMPORTED_PROJECT_NAME = 'Imported project';
const MAX_NAME_LENGTH = 100;
const READ_CHUNK = 1024 * 1024;
const PROJECT_FILE = new RegExp(`\\.${EXTENSION}$`, 'i');
// Unsafe in a file name on at least one platform a copy may travel to.
const UNSAFE_CHARACTERS = /[\\/:*?"<>|\p{Cc}]/gu;

export type ImportRejection =
	'unreadable' | 'too_large' | 'invalid' | 'legacy_unsupported' | 'legacy_failed' | 'other_device';

export type ImportResult =
	| { status: 'cancelled' }
	| { status: 'rejected'; reason: ImportRejection }
	| { status: 'imported'; path: string };

export const IMPORT_REJECTIONS: Record<ImportRejection, { title: string; description: string }> = {
	unreadable: { title: 'Failed to import file', description: 'The file could not be read.' },
	too_large: {
		title: 'Not a HEDA file',
		description: 'The file is far larger than any HEDA project. Pick a .heda file.'
	},
	invalid: { title: 'Not a HEDA file', description: 'The file is not a valid HEDA file.' },
	legacy_unsupported: {
		title: 'Legacy file cannot be upgraded',
		description: 'This build does not include the legacy keys needed to open version 1 files.'
	},
	legacy_failed: {
		title: 'Legacy file cannot be upgraded',
		description:
			'This version 1 file could not be decrypted. Open it in the desktop app to upgrade it, then import it again.'
	},
	other_device: {
		title: 'File was encrypted on another device',
		description:
			'This .heda file uses the key of the device that made it and cannot be opened here. Ask the owner for a password-protected copy.'
	}
};

const stripEdges = (name: string) => name.replace(/^[.\s]+|[.\s]+$/g, '');

/**
 * A project name that is safe as a file name, or '' when nothing usable is
 * left. Leading dots would hide the file; trailing dots and spaces are dropped
 * by Windows, where a shared copy may end up.
 */
export function sanitizeProjectName(name: string): string {
	const safe = stripEdges(name.replace(/\s+/g, ' ').replace(UNSAFE_CHARACTERS, '-'));
	// Cut by code point, so an emoji is never split in half.
	return stripEdges(Array.from(safe).slice(0, MAX_NAME_LENGTH).join(''));
}

/** `name.heda`, else `name-(n).heda` with the first free n. Case-insensitive. */
export function uniqueProjectFileName(name: string, taken: Iterable<string>): string {
	const used = new Set(Array.from(taken, (file) => file.toLowerCase()));
	let file = `${name}.${EXTENSION}`;
	for (let n = 1; used.has(file.toLowerCase()); n++) file = `${name}-(${n}).${EXTENSION}`;
	return file;
}

/** The decoded last segment of a document URI, path-like ids included. */
function documentFileName(uri: string): string | null {
	let segment: string;
	try {
		segment = new URL(uri).pathname.split('/').pop() ?? '';
	} catch {
		return null;
	}
	try {
		segment = decodeURIComponent(segment);
	} catch {
		// A stray `%` is not an escape; keep the segment as it is.
	}
	// Ids can embed their own path: `primary:Download/Plan.heda`, `raw:/storage/…/Plan.heda`.
	return segment.split('/').pop() || null;
}

/**
 * Name for an imported document: the provider's display name, else the URI
 * when it names a `.heda` file (opaque ids like `msf:1234` do not), else a
 * generic name.
 */
export function importedProjectName(display_name: string | null | undefined, uri: string): string {
	const from_provider = sanitizeProjectName((display_name ?? '').replace(PROJECT_FILE, ''));
	if (from_provider) return from_provider;
	const file = documentFileName(uri);
	const from_uri =
		file && PROJECT_FILE.test(file) ? sanitizeProjectName(file.replace(PROJECT_FILE, '')) : '';
	return from_uri || IMPORTED_PROJECT_NAME;
}

/** The absolute path of the projects folder, created when missing. */
export async function libraryDir(): Promise<string> {
	const dir = `${await appLocalDataDir()}/${LIBRARY_FOLDER}`;
	await mkdir(dir, { recursive: true });
	return dir;
}

/** Projects in the folder, newest first; files without a time sort last, by name. */
export async function listLibraryProjects(): Promise<LibraryProject[]> {
	const dir = await libraryDir();
	const files = (await readDir(dir)).filter(
		(entry) => entry.isFile && PROJECT_FILE.test(entry.name)
	);
	const projects = await Promise.all(
		files.map(async ({ name }) => {
			const path = `${dir}/${name}`;
			const info = await stat(path).catch(() => null);
			return { name: name.replace(PROJECT_FILE, ''), path, modified: info?.mtime ?? null };
		})
	);
	const time = (project: LibraryProject) => project.modified?.getTime() ?? -Infinity;
	return projects.sort((a, b) => time(b) - time(a) || a.name.localeCompare(b.name));
}

/** A free path in the folder for a project called `name` (sanitized). Nothing is created. */
export async function newLibraryFile(name: string): Promise<string> {
	const dir = await libraryDir();
	const taken = (await readDir(dir)).map((entry) => entry.name);
	const file = uniqueProjectFileName(sanitizeProjectName(name) || UNTITLED_PROJECT_NAME, taken);
	return `${dir}/${file}`;
}

/** Deletes a project file and what was made from it (`Plan.heda.v2.bak`, …), never another project. */
export async function deleteLibraryProject(path: string): Promise<void> {
	const dir = await libraryDir();
	const file = path.startsWith(`${dir}/`) ? path.slice(dir.length + 1) : '';
	if (!file || file.includes('/') || !PROJECT_FILE.test(file)) {
		throw new Error('Only a project in the app folder can be deleted.');
	}
	await remove(path);
	const leftovers = (await readDir(dir)).filter(
		(entry) => entry.isFile && entry.name.startsWith(`${file}.`) && !PROJECT_FILE.test(entry.name)
	);
	await Promise.all(
		leftovers.map((entry) => remove(`${dir}/${entry.name}`).catch(() => undefined))
	);
}

/** The whole file, or null as soon as it grows past `limit` bytes. */
export async function readCapped(path: string, limit: number): Promise<Uint8Array | null> {
	const file = await open(path, { read: true });
	try {
		const chunks: Uint8Array[] = [];
		let total = 0;
		for (;;) {
			const buffer = new Uint8Array(READ_CHUNK);
			const read = await file.read(buffer);
			if (!read) break;
			total += read;
			if (total > limit) return null;
			chunks.push(buffer.subarray(0, read));
		}
		const bytes = new Uint8Array(total);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.length;
		}
		return bytes;
	} finally {
		await file.close();
	}
}

function memoryFileIO(files: Map<string, Uint8Array>): MigrationFileIO {
	return {
		read: async (path) => {
			const bytes = files.get(path);
			if (!bytes) throw new Error(`${path} does not exist`);
			return bytes;
		},
		write: async (path, bytes) => void files.set(path, bytes),
		exists: async (path) => files.has(path),
		remove: async (path) => void files.delete(path)
	};
}

/**
 * The bytes to store for an imported file, or why it cannot be imported.
 * A v1 file is upgraded to device encryption here, in memory, while its
 * original name is known: some v1 files are keyed to it, and the copy gets a
 * name of its own. The original stays untouched where it was.
 */
export async function prepareImport(
	bytes: Uint8Array,
	original_name: string
): Promise<Uint8Array | ImportRejection> {
	const raw = new TextDecoder().decode(bytes);
	const version = detectFileVersion(raw);
	if (version === 2) {
		// With no password the check stops at "password required" only for a whole envelope.
		const outcome = await decryptFilePayload(raw, null, null, 2).catch((err: unknown) => err);
		return outcome instanceof FilePasswordError && outcome.code === 'required' ? bytes : 'invalid';
	}
	if (version === 3) {
		try {
			await decryptFilePayload(raw, null, await getDeviceKey(), 3);
			return bytes;
		} catch (err) {
			return err instanceof FileDeviceKeyError ? 'other_device' : 'invalid';
		}
	}
	if (!(await isLegacyV1Envelope(raw))) return 'invalid';
	const config = getLegacyV1Config();
	if (!config) return 'legacy_unsupported';
	const files = new Map([[original_name, bytes]]);
	try {
		await migrateLegacyFile({
			file_path: original_name,
			device_key: await getDeviceKey(),
			legacy: {
				passphrase: config.passphrase,
				salts: legacyV1SaltCandidates(original_name, config.salt)
			},
			io: memoryFileIO(files)
		});
	} catch {
		return 'legacy_failed';
	}
	return files.get(original_name) ?? 'legacy_failed';
}

/** Picks a file, checks it, and copies it into the projects folder. */
export async function importIntoLibrary(): Promise<ImportResult> {
	const uri = await openDialog({ multiple: false, directory: false });
	if (!uri) return { status: 'cancelled' };
	const info = await invoke<{ name?: string | null; size?: number | null }>('document_info', {
		uri
	}).catch(() => ({ name: null, size: null }));
	if (info.size != null && info.size > IMPORT_SIZE_LIMIT) {
		return { status: 'rejected', reason: 'too_large' };
	}
	let bytes: Uint8Array | null;
	try {
		bytes = await readCapped(uri, IMPORT_SIZE_LIMIT);
	} catch {
		return { status: 'rejected', reason: 'unreadable' };
	}
	if (!bytes) return { status: 'rejected', reason: 'too_large' };
	const original_name = info.name || documentFileName(uri) || '';
	const prepared = await prepareImport(bytes, original_name);
	if (typeof prepared === 'string') return { status: 'rejected', reason: prepared };
	const path = await newLibraryFile(importedProjectName(info.name, uri));
	await writeFile(path, prepared, { createNew: true });
	return { status: 'imported', path };
}
