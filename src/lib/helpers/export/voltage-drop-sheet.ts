import type ExcelJS from 'exceljs';
import { computeVoltageDropsFromNodes } from '#lib/db/queries/voltage-drop-core.js';
import { default_phases } from '#lib/constants.js';
import type { Node } from '#lib/types/db.js';
import type { ExportProcessResult, Header } from './types.js';

export async function processVoltageDropSheet(
	workbook: ExcelJS.Workbook,
	nodes: Node[] = [],
	is_dynamic = false
): Promise<ExportProcessResult> {
	const worksheet = workbook.addWorksheet('Voltage Drop');

	const startRow = worksheet.rowCount > 0 ? worksheet.rowCount + 1 : 1;

	// A 3P-Y study mixes 400 V and 230 V runs (PEC 2017 App. D Ex. D15), so each row names its phase and voltage.
	const is_wye =
		nodes.find((node) => node.node_type === 'root')?.highest_unit_form?.phase ===
		default_phases.THREE_PHASE_WYE;
	const table_headers: Header[] = [
		{ text: 'From NODE', cols: 1 },
		{ text: 'To NODE', cols: 1 },
		...(is_wye
			? [
					{ text: 'PHASE', cols: 1 },
					{ text: 'VOLTAGE', cols: 1, sub_cols: ['(V)'] }
				]
			: []),
		{ text: 'CABLE', cols: 3, sub_cols: ['Sets', 'Qty', 'Size (mm2)'] },
		{ text: 'Z', cols: 1, sub_cols: ['(Ω/305m)'] },
		{ text: 'LENGTH', cols: 1, sub_cols: ['(m)'] },
		{ text: 'CURRENT', cols: 1, sub_cols: ['(A)'] },
		{ text: 'Actual Z', cols: 1, sub_cols: ['(Ω)'] },
		{ text: 'VOLTAGE DROP (V)', cols: 2, sub_cols: ['Per Segment', 'At End Circuit'] },
		{ text: 'VOLTAGE AT RECEIVING END (V)', cols: 1 },
		{ text: 'PERCENTAGE VOLTAGE DROP (%)', cols: 1 }
	];

	let current_header_column = 1;

	table_headers.forEach((header: Header) => {
		const cell = worksheet.getCell(startRow, current_header_column);
		cell.value = header.text;
		cell.font = { bold: true };
		cell.alignment = { horizontal: 'center' };
		cell.border = { top: { style: 'thin' } };

		if (header.sub_cols) {
			worksheet.mergeCells(
				startRow,
				current_header_column,
				startRow,
				current_header_column + header.cols - 1
			);
			header.sub_cols.forEach((subText, i) => {
				const subCell = worksheet.getCell(startRow + 1, current_header_column + i);
				subCell.value = subText;
				subCell.font = { bold: true };
				subCell.alignment = { horizontal: 'center' };
				subCell.border = { bottom: { style: 'thick' } };
			});
		} else {
			worksheet.mergeCells(startRow, current_header_column, startRow + 1, current_header_column);
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = { bottom: { style: 'thick' }, top: { style: 'thin' } };
		}
		current_header_column += header.cols;
	});

	const voltage_drops = computeVoltageDropsFromNodes(nodes, is_dynamic);
	let current_load_row = startRow + 2;

	for (const voltage_drop_node of voltage_drops) {
		const loadCells = [
			voltage_drop_node.from_node_name,
			voltage_drop_node.to_node_name,
			...(is_wye ? [voltage_drop_node.phase, voltage_drop_node.voltage] : []),
			voltage_drop_node.conductor_sets,
			voltage_drop_node.conductor_qty,
			voltage_drop_node.conductor_size,
			voltage_drop_node.z,
			voltage_drop_node.length,
			voltage_drop_node.current,
			voltage_drop_node.actual_z,
			voltage_drop_node.voltage_per_segment,
			voltage_drop_node.voltage_at_end_circuit,
			voltage_drop_node.voltage_at_receiving_end,
			voltage_drop_node.percent_voltage_drop
		];

		loadCells.forEach((value, index) => {
			const cell = worksheet.getCell(current_load_row, index + 1);
			cell.value = value;
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = { bottom: { style: 'thin' } };
		});
		current_load_row++;
	}

	for (let i = 0; i < worksheet.columns.length; i += 1) {
		let dataMax = 0;
		const column = worksheet.columns[i];
		for (let j = 1; j < (column.values?.length ?? 0); j += 1) {
			const columnLength = String(column.values?.[j] ?? '').length;
			if (columnLength > dataMax) {
				dataMax = columnLength;
			}
		}
		column.width = dataMax < 10 ? 10 : dataMax;
	}

	return { valid: true };
}
