import type { Node } from '#lib/types/db.js';
import { toast } from 'svelte-sonner';
import type { ExcelExportType } from '#lib/types/misc.js';
import { generateWorkbookInWorker } from '#lib/workers/export-client.js';
import { isTauri } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { showInFolderAction } from '#lib/helpers/file/reveal.js';
import { isAndroidApp } from '#lib/helpers/platform.js';

export { processExcelPanelBoardSchedule } from './panel-board-sheet.js';
export { processVoltageDropSheet } from './voltage-drop-sheet.js';

export async function exportToExcel(
	type: ExcelExportType,
	node_id: string,
	highest_unit?: Node['highest_unit_form'],
	file_name?: string,
	idle_callaback?: () => void,
	loading_calback?: () => void
): Promise<void> {
	if (!highest_unit) {
		toast.warning('No project found', {
			description: 'Cannot proceed with the export.',
			position: 'bottom-center'
		});
		return;
	}

	const _file_name = file_name ?? 'Exported Panelboard Schedule';
	loading_calback?.();
	toast.info(`Exporting to Excel... ${_file_name}.xlsx`, {
		description: 'Please wait, this should last very long.',
		position: 'bottom-center'
	});

	try {
		const { getExportInputs } = await import('#lib/db/queries/export.js');
		const generated = await generateWorkbookInWorker({
			type,
			node_id,
			highest_unit,
			file_name: _file_name,
			...(await getExportInputs(type))
		});

		const output_file_name = `${generated.title}.xlsx`;

		if (isTauri()) {
			// Desktop: let the user pick the destination. A browser download would
			// vanish into an unknown Downloads folder and we could not reveal it.
			const path = await saveDialog({
				defaultPath: output_file_name,
				filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }]
			});
			if (!path) {
				idle_callaback?.();
				return;
			}
			await writeFile(path, new Uint8Array(generated.buffer));
			toast.success('Export finished successfully.', {
				// On Android the path is an opaque content:// document link.
				description: isAndroidApp() ? 'Saved where you picked in the file picker.' : path,
				action: showInFolderAction(path),
				position: 'bottom-center'
			});
		} else {
			const blob = new Blob([generated.buffer], {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = output_file_name;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			toast.success('Export finished successfully.', {
				description: 'The file has been downloaded successfully',
				position: 'bottom-center'
			});
		}
	} catch (error) {
		idle_callaback?.();
		toast.warning(`Something went wrong while exporting: ${String(error)}`, {
			description: 'An error occurred while exporting.',
			position: 'bottom-center'
		});
		return;
	}

	idle_callaback?.();
}
