import type { Node } from '#lib/types/db.js';
import type { ExcelExportType, ExportInputs } from '#lib/types/misc.js';
import { DEFAULT_PHASES, default_phases } from '#lib/constants.js';
import { convertToNormalText, getOptionLabel } from '#lib/utils/format.js';
import { processExcelPanelBoardSchedule } from './panel-board-sheet.js';
import { processVoltageDropSheet } from './voltage-drop-sheet.js';

export interface GeneratedWorkbook {
	buffer: ArrayBuffer;
	title: string;
}

export async function generateWorkbook(
	payload: {
		type: ExcelExportType;
		node_id: string;
		highest_unit?: Node['highest_unit_form'];
		file_name?: string;
	} & ExportInputs
): Promise<GeneratedWorkbook> {
	const { default: excel } = await import('exceljs');
	const workbook = new excel.Workbook();
	const file_name = payload.file_name ?? 'Exported Panelboard Schedule';
	workbook.title = `Exported ${file_name} ${convertToNormalText(payload.type, true)}`;
	workbook.creator = 'HEDA(Desktop App)';

	const highest_unit = payload.highest_unit;
	if (!highest_unit) {
		throw new Error('No highest unit found');
	}

	// Callers read the engine's results before posting them to the worker, so the
	// worker never imports the database/Tauri graph.
	const { nodes, rows, voltage_drops } = payload;

	const phase_label = getOptionLabel(DEFAULT_PHASES, highest_unit?.phase);
	switch (highest_unit?.phase) {
		case default_phases.ONE_PHASE:
		case default_phases.THREE_PHASE_WYE:
			workbook.subject = `${phase_label} ${convertToNormalText(payload.type, true)}`;
			workbook.category = [
				phase_label,
				`${convertToNormalText(payload.type, true)}`,
				'Export'
			].join(',');
			workbook.description = `${phase_label} ${convertToNormalText(payload.type, true)}`;
			switch (payload.type) {
				case 'LOAD_SCHEDULE': {
					const result = await processExcelPanelBoardSchedule(
						workbook,
						payload.node_id,
						highest_unit,
						{ nodes, rows }
					);
					if (!result.valid) {
						throw new Error(result.message ?? 'Failed to process load schedule');
					}
					break;
				}
				case 'VOLTAGE_DROP': {
					const result = await processVoltageDropSheet(workbook, { nodes, voltage_drops });
					if (!result.valid) {
						throw new Error(result.message ?? 'Failed to process voltage drop');
					}
					break;
				}
			}
			break;
		case default_phases.THREE_PHASE_DELTA:
			throw new Error('Three-phase delta load schedule is not yet supported');
		default:
			throw new Error('Unknown phase');
	}

	// ExcelJS returns a Buffer (a Uint8Array, possibly a view into a larger pool),
	// not the ArrayBuffer its types claim. The worker transfers this to the page,
	// and only a real, exactly sized ArrayBuffer can be transferred.
	const bytes = await workbook.xlsx.writeBuffer();
	return { buffer: new Uint8Array(bytes).buffer, title: workbook.title };
}
