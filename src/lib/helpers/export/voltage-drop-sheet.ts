import type ExcelJS from 'exceljs';
import { getComputedVoltageDrops } from '#lib/db/queries/index.js';
import type { ExportProcessResult, Header } from './types.js';

export async function processOnePhaseVoltageDrop(
	workbook: ExcelJS.Workbook
): Promise<ExportProcessResult> {
	const worksheet = workbook.addWorksheet('Voltage Drop');

	const startRow = worksheet.rowCount > 0 ? worksheet.rowCount + 1 : 1;

	const table_headers: Header[] = [
		{ text: 'From NODE', cols: 1 },
		{ text: 'To NODE', cols: 1 },
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

	const voltage_drops = getComputedVoltageDrops();
	let current_load_row = startRow + 2;

	for (const voltage_drop_node of voltage_drops) {
		const loadCells = [
			{ column: 'A', value: voltage_drop_node.from_node_name },
			{ column: 'B', value: voltage_drop_node.to_node_name },
			{ column: 'C', value: voltage_drop_node.conductor_sets },
			{ column: 'D', value: voltage_drop_node.conductor_qty },
			{ column: 'E', value: voltage_drop_node.conductor_size },
			{ column: 'F', value: voltage_drop_node.z },
			{ column: 'G', value: voltage_drop_node.length },
			{ column: 'H', value: voltage_drop_node.current },
			{ column: 'I', value: voltage_drop_node.actual_z },
			{ column: 'J', value: voltage_drop_node.voltage_per_segment },
			{ column: 'K', value: voltage_drop_node.voltage_at_end_circuit },
			{ column: 'L', value: voltage_drop_node.voltage_at_receiving_end },
			{ column: 'M', value: voltage_drop_node.percent_voltage_drop }
		];

		loadCells.forEach(({ column, value }) => {
			const cell = worksheet.getCell(`${column}${current_load_row}`);
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
