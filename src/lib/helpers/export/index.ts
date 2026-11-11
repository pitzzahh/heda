import type { Node } from '#lib/types/db/index.js';
import { toast } from 'svelte-sonner';
import type { ExcelExportType } from '#lib/types/misc/index.js';
import { generateWorkbookInWorker } from '#lib/workers/export-client.js';

export { processOnePhaseExcelPanelBoardSchedule } from './panel-board-sheet.js';
export { processOnePhaseVoltageDrop } from './voltage-drop-sheet.js';

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
		const snapshot = (await import('#lib/db/queries/snapshot.js')).loadSnapshot();
		const generated = await generateWorkbookInWorker({
			type,
			node_id,
			highest_unit,
			file_name: _file_name,
			nodes: snapshot.nodes,
			is_dynamic: snapshot.is_dynamic
		});

		const blob = new Blob([generated.buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${generated.title}.xlsx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		toast.success('Export finished successfully.', {
			description: 'The file has been downloaded successfully',
			position: 'bottom-center'
		});
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
