import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { settled } from '#lib/db/index.js';
import { showInFolderAction } from '#lib/helpers/file/reveal.js';
import { isAndroidApp } from '#lib/helpers/platform.js';

/**
 * Builds the permit sheet set in the engine (`crates/heda-core/src/sheet_set.rs`) and
 * saves it where the user picks, like the Excel export. The title block is the one stored
 * on the project, so save it there first.
 */
export async function exportSheetSet(project_name: string): Promise<void> {
	const path = await saveDialog({
		defaultPath: `${project_name} Sheet Set.pdf`,
		filters: [{ name: 'PDF document', extensions: ['pdf'] }]
	});
	if (!path) return;
	// The engine reads the project and nodes as written; let pending writes land first.
	await settled();
	const date = new Date().toISOString().slice(0, 10);
	const bytes = await invoke<ArrayBuffer>('sheet_set', { projectName: project_name, date });
	await writeFile(path, new Uint8Array(bytes));
	toast.success('Sheet set saved.', {
		// On Android the path is an opaque content:// document link.
		description: isAndroidApp() ? 'Saved where you picked in the file picker.' : path,
		action: showInFolderAction(path),
		position: 'bottom-center'
	});
}
