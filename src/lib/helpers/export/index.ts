import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { engineFile } from '#lib/core/api.js';
import { showInFolderAction } from '#lib/helpers/file/reveal.js';
import { isAndroidApp } from '#lib/helpers/platform.js';
import { convertToNormalText } from '#lib/utils/format.js';
import type { Node } from '#lib/types/db.js';
import type { ExcelExportType } from '#lib/types/misc.js';

/**
 * Builds a workbook in the engine (`crates/heda-core/src/workbook.rs`): the schedule of
 * loads of `node_id` and every panel below it, or the project's voltage drop table, and
 * saves it where the user picks.
 */
export async function exportToExcel(
	type: ExcelExportType,
	node_id: string,
	highest_unit?: Node['highest_unit_form'],
	file_name?: string,
	idle_callback?: () => void,
	loading_callback?: () => void
): Promise<void> {
	if (!highest_unit) {
		toast.warning('No project found', {
			description: 'Cannot proceed with the export.',
			position: 'bottom-center'
		});
		return;
	}
	const title = `Exported ${file_name ?? 'Exported Panelboard Schedule'} ${convertToNormalText(type, true)}`;
	loading_callback?.();
	try {
		const path = await saveDialog({
			defaultPath: `${title}.xlsx`,
			filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }]
		});
		if (!path) return;
		await writeFile(path, await engineFile('workbook', { kind: type, node_id, title }));
		toast.success('Export finished successfully.', {
			// On Android the path is an opaque content:// document link.
			description: isAndroidApp() ? 'Saved where you picked in the file picker.' : path,
			action: showInFolderAction(path),
			position: 'bottom-center'
		});
	} catch (error) {
		toast.warning(`Something went wrong while exporting: ${String(error)}`, {
			description: 'An error occurred while exporting.',
			position: 'bottom-center'
		});
	} finally {
		idle_callback?.();
	}
}
