import { isTauri } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { toast } from 'svelte-sonner';
import { isAndroidApp } from '#lib/helpers/platform.js';

/**
 * Opens the OS file manager with `path` selected. A browser has no file manager
 * to reveal a file in, and Android has no "reveal" (the opener plugin rejects
 * it there), so both are a no-op.
 */
export async function revealInFileManager(path: string): Promise<void> {
	if (!isTauri() || isAndroidApp() || !path) return;
	try {
		await revealItemInDir(path);
	} catch (err) {
		console.error(`Could not reveal ${path} in the file manager: ${String(err)}`);
		toast.warning('Could not open the file manager', {
			description: `The file is saved at ${path}.`
		});
	}
}

/**
 * Sonner toast action that reveals `path` in the OS file manager, or none on
 * Android, where there is no file manager to reveal it in.
 */
export function showInFolderAction(path: string) {
	if (isAndroidApp()) return undefined;
	return {
		label: 'Show in folder',
		onClick: () => revealInFileManager(path)
	};
}
