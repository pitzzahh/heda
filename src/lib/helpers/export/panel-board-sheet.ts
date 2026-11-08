import type ExcelJS from 'exceljs';
import type { Node } from '#lib/types/db/index.js';
import {
	buildChildrenByParent,
	getComputedLoadsFromNodes,
	getNodeDepthFromNodes,
	getNodeByIdFromNodes
} from '#lib/db/queries/loads-core.js';
import { computeNodeLoad, type LoadComputationContext } from '#lib/db/queries/compute.js';
import { DEFAULT_PHASES } from '#lib/constants/index.js';
import { getOrdinalSuffix, getOptionLabel } from '#lib/utils/format/index.js';
import type { ExportProcessResult, Header } from './types.js';

export async function processOnePhaseExcelPanelBoardSchedule(
	workbook: ExcelJS.Workbook,
	node_id: string,
	highest_unit?: Node['highest_unit_form'],
	nodes: Node[] = [],
	is_dynamic = false
): Promise<ExportProcessResult> {
	const current_node = getNodeByIdFromNodes(nodes, node_id);
	const children = getComputedLoadsFromNodes(nodes, node_id, is_dynamic);
	const computation_context: LoadComputationContext = {
		children_by_parent: buildChildrenByParent(nodes),
		is_dynamic,
		memo: new Map()
	};
	const computed_current_node = current_node
		? computeNodeLoad(current_node, computation_context)
		: undefined;
	if (!computed_current_node) {
		return { valid: false, message: 'Node not found', is_system_error: true };
	}

	if (!current_node) {
		return {
			valid: false,
			message: 'Node not found',
			is_system_error: true
		};
	}

	// Use the existing getNodeDepth2 function to calculate the depth
	const actualDepth = getNodeDepthFromNodes(nodes, node_id);
	const panel_level = getOrdinalSuffix(actualDepth);
	const parent_node = current_node?.parent_id
		? getNodeByIdFromNodes(nodes, current_node.parent_id)
		: undefined;
	const panel_name =
		current_node?.panel_data?.name ??
		current_node?.highest_unit_form?.distribution_unit ??
		'Unknown Panel';
	const from_supply_name =
		current_node?.node_type === 'root' ? '--' : (parent_node?.panel_data?.name ?? 'Transformer');

	let worksheet = workbook.getWorksheet(panel_level);

	if (!worksheet) {
		worksheet = workbook.addWorksheet(panel_level);
	}

	const startRow = worksheet.rowCount > 0 ? worksheet.rowCount + 1 : 1;

	const description_label_column_position_data = [
		{ column: `A${startRow}`, value: 'DESCRIPTION' },
		{ column: `A${startRow + 1}`, value: 'SUPPLY' },
		{ column: `A${startRow + 2}`, value: 'FROM' },
		{ column: `A${startRow + 3}`, value: 'NAME' }
	];

	description_label_column_position_data.forEach(
		({ column, value }) => (worksheet.getCell(column).value = value)
	);

	worksheet.getCell(`B${startRow}`).value = `: PANELBOARD SCHEDULE`;
	worksheet.getCell(`B${startRow + 1}`).value =
		`: ${getOptionLabel(DEFAULT_PHASES, highest_unit?.phase)} + E, ${230}V, ${60}Hz`;
	worksheet.getCell(`B${startRow + 2}`).value = `: ${from_supply_name}`;
	worksheet.getCell(`B${startRow + 3}`).value = `: ${panel_name}`;

	description_label_column_position_data
		.map((e) => e.column)
		.forEach((cell) => {
			worksheet.getCell(cell).font = { bold: true };
		});

	const table_headers: Header[] = [
		{ text: ' ', cols: 1, subText: 'CKT NO.', sub_cols: ['CRKT NO.'] },
		{ text: ' ', cols: 1, sub_cols: ['LOAD DESCRIPTION'] },
		{ text: ' ', cols: 1, sub_cols: ['VOLTAGE (V)'] },
		{ text: ' ', cols: 1, sub_cols: ['APPARENT POWER (VA)'] },
		{ text: ' ', cols: 1, sub_cols: ['CURRENT (A)'] },
		{ text: 'CIRCUIT BREAKER', cols: 4, sub_cols: ['AT', 'AF', 'Pole', 'KAIC'] },
		{ text: 'CONDUCTOR', cols: 4, sub_cols: ['Sets', 'Qty', 'Size (mm2)', 'Insulation'] },
		{ text: 'EGC', cols: 2, sub_cols: ['Size', 'Insulation'] },
		{ text: 'CONDUIT', cols: 2, sub_cols: ['Size', 'Type'] }
	];

	let current_header_column = 1;
	table_headers.forEach((header: Header) => {
		const cell = worksheet.getCell(startRow + 4, current_header_column);
		cell.value = header.text;
		cell.font = { bold: true };
		cell.alignment = { horizontal: 'center' };
		cell.border = { top: { style: 'thin' } };

		if (header.sub_cols) {
			worksheet.mergeCells(
				startRow + 4,
				current_header_column,
				startRow + 4,
				current_header_column + header.cols - 1
			);
			header.sub_cols.forEach((subText, i) => {
				const subCell = worksheet.getCell(startRow + 5, current_header_column + i);
				subCell.value = subText;
				subCell.font = { bold: true };
				subCell.alignment = { horizontal: 'center' };
				subCell.border = { bottom: { style: 'thick' } };
			});
		} else {
			worksheet.mergeCells(
				startRow + 4,
				current_header_column,
				startRow + 5,
				current_header_column
			);
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = { bottom: { style: 'thick' }, top: { style: 'thin' } };
		}
		current_header_column += header.cols;
	});

	const loads = getComputedLoadsFromNodes(nodes, node_id, is_dynamic);
	let current_load_row = startRow + 6;

	for (const load of loads) {
		const loadCells = [
			{ column: 'A', value: load.circuit_number },
			{ column: 'B', value: load.load_description },
			{ column: 'C', value: load.voltage },
			{ column: 'D', value: load.va },
			{ column: 'E', value: load.current },
			{ column: 'F', value: load.at },
			{ column: 'G', value: load.ampere_frames },
			{ column: 'H', value: load.pole },
			{ column: 'I', value: load.kaic },
			{ column: 'J', value: load.conductor_sets },
			{ column: 'K', value: load.conductor_qty },
			{ column: 'L', value: load.conductor_size },
			{ column: 'M', value: load.conductor_insulation },
			{ column: 'N', value: load.egc_size },
			{ column: 'O', value: load.egc_insulation },
			{ column: 'P', value: load.conduit_size },
			{ column: 'Q', value: load.conduit_type }
		];

		loadCells.forEach(({ column, value }) => {
			const cell = worksheet.getCell(`${column}${current_load_row}`);
			cell.value = value;
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = { bottom: { style: 'thin' } };
		});
		current_load_row++;
	}

	const main_columns = [
		{ column: 'A', value: 'TOTAL' },
		{ column: 'B', value: 'MAIN' },
		{ column: 'C', value: computed_current_node!.voltage.toString() },
		{ column: 'D', value: computed_current_node!.va.toString() },
		{ column: 'E', value: computed_current_node!.current.toString() },
		{ column: 'F', value: computed_current_node!.at.toString() },
		{ column: 'G', value: computed_current_node!.ampere_frames.toString() },
		{ column: 'H', value: computed_current_node!.pole ?? 'N/A' },
		{ column: 'I', value: computed_current_node!.kaic ?? 'N/A' },
		{ column: 'J', value: computed_current_node!.conductor_sets?.toString() ?? 'N/A' },
		{ column: 'K', value: computed_current_node!.conductor_qty?.toString() ?? 'N/A' },
		{ column: 'L', value: computed_current_node!.conductor_size.toString() },
		{ column: 'M', value: computed_current_node!.conductor_insulation ?? 'N/A' },
		{ column: 'N', value: computed_current_node!.egc_size.toString() },
		{ column: 'O', value: computed_current_node!.egc_insulation ?? 'N/A' },
		{ column: 'P', value: computed_current_node!.conduit_size.toString() },
		{ column: 'Q', value: computed_current_node!.conduit_type ?? 'N/A' }
	];

	main_columns.forEach(({ column, value }) => {
		const cell = worksheet.getCell(`${column}${current_load_row}`);
		cell.value = value;
		cell.font = { bold: true };
		cell.alignment = { vertical: 'middle', horizontal: 'center' };
		cell.border = { top: { style: 'thin' }, bottom: { style: 'thick' } };
	});

	const emptyRow = worksheet.getRow(current_load_row + 2);
	emptyRow.height = 15;

	// Process children
	for (const child of children) {
		if (child.node_type === 'root' || child.node_type === 'panel') {
			await processOnePhaseExcelPanelBoardSchedule(
				workbook,
				child.id,
				highest_unit,
				nodes,
				is_dynamic
			);
		}
	}

	for (let i = 0; i < worksheet.columns.length; i += 1) {
		let dataMax = 0;
		const column = worksheet.columns[i];
		const headerLength = String(column.values?.[1] ?? '').length;
		for (let j = 1; j < (column.values?.length ?? 0); j += 1) {
			const columnLength = String(column.values?.[j] ?? '').length;
			if (columnLength > dataMax) {
				dataMax = columnLength;
			}
		}
		column.width = Math.max(dataMax, headerLength, 10);
	}

	return { valid: true };
}
