import type { Node } from '#lib/types/db/index.js';
import { loadSnapshot } from '#lib/db/queries/snapshot.js';
import type { ExcelExportType } from '#lib/types/misc/index.js';
import { DEFAULT_PHASES, default_phases } from '#lib/constants/index.js';
import { convertToNormalText, getOptionLabel } from '#lib/utils/format/index.js';
import { processOnePhaseExcelPanelBoardSchedule } from './panel-board-sheet.js';
import { processOnePhaseVoltageDrop } from './voltage-drop-sheet.js';

export interface GeneratedWorkbook {
	buffer: ArrayBuffer;
	title: string;
}

export async function generateWorkbook(payload: {
	type: ExcelExportType;
	node_id: string;
	highest_unit?: Node['highest_unit_form'];
	file_name?: string;
	nodes?: Node[];
	is_dynamic?: boolean;
}): Promise<GeneratedWorkbook> {
	const { default: excel } = await import('exceljs');
	const workbook = new excel.Workbook();
	const file_name = payload.file_name ?? 'Exported Panelboard Schedule';
	workbook.title = `Exported ${file_name} ${convertToNormalText(payload.type, true)}`;
	workbook.creator = 'HEDA(Desktop App)';

	const highest_unit = payload.highest_unit;
	if (!highest_unit) {
		throw new Error('No highest unit found');
	}

	const snapshot = payload.nodes
		? null
		: (loadSnapshot() as { nodes: Node[]; is_dynamic: boolean });
	const nodes = payload.nodes ?? snapshot!.nodes;
	const is_dynamic = payload.nodes ? (payload.is_dynamic ?? false) : snapshot!.is_dynamic;

	const phase_label = getOptionLabel(DEFAULT_PHASES, highest_unit?.phase);
	switch (highest_unit?.phase) {
		case default_phases.ONE_PHASE:
			workbook.subject = `${phase_label} ${convertToNormalText(payload.type, true)}`;
			workbook.category = [
				phase_label,
				`${convertToNormalText(payload.type, true)}`,
				'Export'
			].join(',');
			workbook.description = 'Load schedule for 1 phase load schedule';
			switch (payload.type) {
				case 'LOAD_SCHEDULE': {
					const result = await processOnePhaseExcelPanelBoardSchedule(
						workbook,
						payload.node_id,
						highest_unit,
						nodes,
						is_dynamic
					);
					if (!result.valid) {
						throw new Error(result.message ?? 'Failed to process load schedule');
					}
					break;
				}
				case 'VOLTAGE_DROP': {
					const result = await processOnePhaseVoltageDrop(workbook, nodes, is_dynamic);
					if (!result.valid) {
						throw new Error(result.message ?? 'Failed to process voltage drop');
					}
					break;
				}
			}
			break;
		case default_phases.THREE_PHASE_WYE:
		case default_phases.THREE_PHASE_DELTA:
			throw new Error('Three phase load schedule is not yet supported');
		default:
			throw new Error('Unknown phase');
	}

	const buffer = await workbook.xlsx.writeBuffer();
	return { buffer: buffer as ArrayBuffer, title: workbook.title };
}
