import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { engineFile } from '#lib/core/api.js';
import { showInFolderAction } from '#lib/helpers/file/reveal.js';
import { isAndroidApp } from '#lib/helpers/platform.js';

/**
 * Saves the riser diagram from `node_id` down where the user picks, written by the engine
 * (`crates/heda-core/src/riser_svg.rs`): the whole diagram at 100 % whatever the pan and
 * zoom, black on white whatever the app theme.
 */
export async function exportRiserSvg(node_id: string, name: string): Promise<void> {
	const path = await saveDialog({
		defaultPath: `${name} Riser Diagram.svg`,
		filters: [{ name: 'SVG image', extensions: ['svg'] }]
	});
	if (!path) return;
	await writeFile(path, await engineFile('riser_svg', { node_id }));
	toast.success('Riser diagram saved.', {
		// On Android the path is an opaque content:// document link.
		description: isAndroidApp() ? 'Saved where you picked in the file picker.' : path,
		action: showInFolderAction(path),
		position: 'bottom-center'
	});
}
