import { convertToNormalText, getOptionLabel } from '#lib/utils/format/index.js';
import type { Node } from '#lib/types/db/index.js';
import { DEFAULT_PHASES, default_phases } from '#lib/constants/index.js';
import { toast } from 'svelte-sonner';
import type { ExcelExportType } from '#lib/types/misc/index.js';
import { processOnePhaseExcelPanelBoardSchedule } from './panel-board-sheet.js';
import { processOnePhaseVoltageDrop } from './voltage-drop-sheet.js';

export { processOnePhaseExcelPanelBoardSchedule, processOnePhaseVoltageDrop };

export async function exportToExcel(
	type: ExcelExportType,
	node_id: string,
	highest_unit?: Node['highest_unit_form'],
	file_name?: string,
	idle_callaback?: () => void,
	loading_calback?: () => void
) {
	if (!highest_unit) {
		return toast.warning('No project found', {
			description: 'Cannot proceed with the export.',
			position: 'bottom-center'
		});
	}

	if (!highest_unit) {
		return toast.warning('No highest unit found, nothing to export', {
			description: 'This is a system error and should not be here, the error has been logged.',
			position: 'bottom-center'
		});
	}
	const _file_name = file_name ?? 'Exported Panelboard Schedule';
	loading_calback?.();
	toast.info(`Exporting to Excel... ${_file_name}.xlsx`, {
		description: 'Please wait, this should last very long.',
		position: 'bottom-center'
	});

	// Deferred: exceljs parses only when exporting, never at startup.
	const { default: excel } = await import('exceljs');
	const workbook = new excel.Workbook();
	workbook.title = `Exported ${file_name} ${convertToNormalText(type, true)}`;
	workbook.creator = 'HEDA(Desktop App)';

	try {
		const phase_label = getOptionLabel(DEFAULT_PHASES, highest_unit?.phase);
		switch (highest_unit?.phase) {
			case default_phases.ONE_PHASE:
				workbook.subject = `${phase_label} ${convertToNormalText(type, true)}`;
				workbook.category = [phase_label, `${convertToNormalText(type, true)}`, 'Export'].join(',');
				workbook.description = 'Load schedule for 1 phase load schedule';
				switch (type) {
					case 'LOAD_SCHEDULE': {
						const load_schedule_process_result = await processOnePhaseExcelPanelBoardSchedule(
							workbook,
							node_id,
							highest_unit
						);
						if (!load_schedule_process_result.valid) {
							idle_callaback?.();
							console.error(
								`Error while processing 1P load schedule: ${JSON.stringify(load_schedule_process_result)}`
							);
							return toast.warning(
								load_schedule_process_result.message ?? 'Something went wrong while exporting',
								{
									description: load_schedule_process_result?.is_system_error
										? 'This is a system error and should not be here, the error has been logged.'
										: (load_schedule_process_result?.description ?? undefined),
									position: 'bottom-center'
								}
							);
						}
						break;
					}
					case 'VOLTAGE_DROP': {
						const voltage_drop_process_result = await processOnePhaseVoltageDrop(workbook);
						if (!voltage_drop_process_result.valid) {
							idle_callaback?.();
							console.error(
								`Error while processing 1P voltage drop: ${JSON.stringify(voltage_drop_process_result)}`
							);
							return toast.warning(
								voltage_drop_process_result.message ?? 'Something went wrong while exporting',
								{
									description: voltage_drop_process_result?.is_system_error
										? 'This is a system error and should not be here, the error has been logged.'
										: (voltage_drop_process_result?.description ?? undefined),
									position: 'bottom-center'
								}
							);
						}
						break;
					}
				}
				break;
			case default_phases.THREE_PHASE_WYE:
			case default_phases.THREE_PHASE_DELTA:
				workbook.subject = `${phase_label} Load Schedule`;
				workbook.category = [phase_label, 'Load Schedule', 'Export'].join(',');
				workbook.description = 'Load schedule for 3 phase load schedule';
				return toast.warning('This feature is still under development', {
					description: 'Three phase load schedule is not yet supported',
					position: 'bottom-center'
				});
			default:
				idle_callaback?.();
				workbook.subject = 'Unknown Load Schedule';
				return toast.warning('Something went wrong while exporting', {
					description: 'This is a system error and should not be here, the error has been logged.',
					position: 'bottom-center'
				});
		}
	} catch (e) {
		idle_callaback?.();
		return toast.warning(`Something went wrong while exporting:: ${e?.toString()}`, {
			description: 'This is a system error and should not be here, the error has been logged.',
			position: 'bottom-center'
		});
	}

	// Write the workbook and trigger download
	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	});
	const url = URL.createObjectURL(blob);

	// Create a link and download the file
	const link = document.createElement('a');
	link.href = url;
	link.download = `${workbook.title}.xlsx`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	// Free resources
	URL.revokeObjectURL(url);
	toast.success('Export finished successfully.', {
		description: 'The file has been downloaded successfully',
		position: 'bottom-center'
	});
	idle_callaback?.();
}
