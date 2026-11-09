import { exists, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { MigrationFileIO } from './migration.js';

/** Tauri-backed file IO for the one-time legacy migration. */
export function tauriMigrationFileIO(): MigrationFileIO {
	return {
		read: (path) => readFile(path),
		write: (path, bytes) => writeFile(path, bytes),
		exists: (path) => exists(path),
		remove: (path) => remove(path)
	};
}
