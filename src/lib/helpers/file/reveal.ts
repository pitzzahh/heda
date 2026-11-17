import { isTauri } from '@tauri-apps/api/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { toast } from 'svelte-sonner';

/**
 * Opens the OS file manager with `path` selected. A browser has no file manager
 * to reveal a file in, so web builds are a no-op.
 */
export async function revealInFileManager(path: string): Promise<void> {
	if (!isTauri() || !path) return;
	try {
		await revealItemInDir(path);
	} catch (err) {
		console.error(`Could not reveal ${path} in the file manager: ${String(err)}`);
		toast.warning('Could not open the file manager', {
			description: `The file is saved at ${path}.`
		});
	}
}

/** Sonner toast action that reveals `path` in the OS file manager. */
export function showInFolderAction(path: string) {
	return {
		label: 'Show in folder',
		onClick: () => revealInFileManager(path)
	};
}
