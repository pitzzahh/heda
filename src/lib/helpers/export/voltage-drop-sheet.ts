import type ExcelJS from 'exceljs';
import { isThreePhaseSupply } from '#lib/utils/computations/index.js';
import type { ExportInputs, ExportProcessResult, Header } from './types.js';
import { fitColumnWidths } from './column-widths.js';
import { dashIfNone } from '#lib/utils/format.js';

export async function processVoltageDropSheet(
	workbook: ExcelJS.Workbook,
	{ nodes, voltage_drops }: Pick<ExportInputs, 'nodes' | 'voltage_drops'>
): Promise<ExportProcessResult> {
	const worksheet = workbook.addWorksheet('Voltage Drop');

	const startRow = worksheet.rowCount > 0 ? worksheet.rowCount + 1 : 1;

	// A three-phase study mixes three-phase and single-phase runs (PEC 2017 App. D Ex. D15), and
	// 3P-Y also 400 V and 230 V ones, so each row names its phase and voltage.
	const is_wye = isThreePhaseSupply(
		nodes.find((node) => node.node_type === 'root')?.highest_unit_form?.phase
	);
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

	let current_load_row = startRow + 2;

	for (const voltage_drop_node of voltage_drops) {
		const loadCells = [
			voltage_drop_node.from_node_name,
			voltage_drop_node.to_node_name,
			...(is_wye ? [voltage_drop_node.phase, voltage_drop_node.voltage] : []),
			voltage_drop_node.conductor_sets,
			voltage_drop_node.conductor_qty,
			dashIfNone(voltage_drop_node.conductor_size),
			dashIfNone(voltage_drop_node.z),
			voltage_drop_node.length,
			voltage_drop_node.current,
			...[
				voltage_drop_node.actual_z,
				voltage_drop_node.voltage_per_segment,
				voltage_drop_node.voltage_at_end_circuit,
				voltage_drop_node.voltage_at_receiving_end,
				voltage_drop_node.percent_voltage_drop
			].map(dashIfNone)
		];

		loadCells.forEach((value, index) => {
			const cell = worksheet.getCell(current_load_row, index + 1);
			cell.value = value;
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = { bottom: { style: 'thin' } };
		});
		current_load_row++;
	}

	fitColumnWidths(worksheet);

	return { valid: true };
}
