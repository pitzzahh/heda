import type ExcelJS from 'exceljs';
import type { Node } from '#lib/types/db.js';
import { buildChildrenByParent, getNodeDepthFromNodes } from '#lib/db/queries/loads-core.js';
import { computeNodeLoad, type LoadComputationContext } from '#lib/db/queries/compute.js';
import { DEFAULT_PHASES, PHASE_ASSIGNMENTS, default_phases } from '#lib/constants.js';
import { getOrdinalSuffix, getOptionLabel } from '#lib/utils/format.js';
import { rowPhaseVa, supplyPhaseOf } from '#lib/utils/computations/index.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import type { ExportProcessResult, Header } from './types.js';
import { fitColumnWidths } from './column-widths.js';

type CellValue = string | number | undefined;

/** One header group of the sheet and how each of its columns reads a load row and the totals row. */
type SheetGroup = Header & {
	row: (load: PhaseLoadSchedule) => CellValue[];
	total: (panel: PhaseLoadSchedule) => CellValue[];
};

const text = (value: number | string | undefined, fallback = 'N/A') =>
	value === undefined ? fallback : value.toString();

/** Columns of a single-phase panelboard schedule, A–Q. */
function baseGroups(): SheetGroup[] {
	return [
		{
			text: ' ',
			cols: 1,
			subText: 'CKT NO.',
			sub_cols: ['CRKT NO.'],
			row: (l) => [l.circuit_number],
			total: () => ['TOTAL']
		},
		{
			text: ' ',
			cols: 1,
			sub_cols: ['LOAD DESCRIPTION'],
			row: (l) => [l.load_description],
			total: () => ['MAIN']
		},
		{
			text: ' ',
			cols: 1,
			sub_cols: ['VOLTAGE (V)'],
			row: (l) => [l.voltage],
			total: (p) => [p.voltage.toString()]
		},
		{
			text: ' ',
			cols: 1,
			sub_cols: ['APPARENT POWER (VA)'],
			row: (l) => [l.va],
			total: (p) => [p.va.toString()]
		},
		{
			text: ' ',
			cols: 1,
			sub_cols: ['CURRENT (A)'],
			row: (l) => [l.current],
			total: (p) => [p.current.toString()]
		},
		{
			text: 'CIRCUIT BREAKER',
			cols: 4,
			sub_cols: ['AT', 'AF', 'Pole', 'KAIC'],
			row: (l) => [l.at, l.ampere_frames, l.pole, l.kaic],
			total: (p) => [p.at.toString(), p.ampere_frames.toString(), text(p.pole), text(p.kaic)]
		},
		{
			text: 'CONDUCTOR',
			cols: 4,
			sub_cols: ['Sets', 'Qty', 'Size (mm2)', 'Insulation'],
			row: (l) => [l.conductor_sets, l.conductor_qty, l.conductor_size, l.conductor_insulation],
			total: (p) => [
				text(p.conductor_sets),
				text(p.conductor_qty),
				p.conductor_size.toString(),
				text(p.conductor_insulation)
			]
		},
		{
			text: 'EGC',
			cols: 2,
			sub_cols: ['Size', 'Insulation'],
			row: (l) => [l.egc_size, l.egc_insulation],
			total: (p) => [p.egc_size.toString(), text(p.egc_insulation)]
		},
		{
			text: 'CONDUIT',
			cols: 2,
			sub_cols: ['Size', 'Type'],
			row: (l) => [l.conduit_size, l.conduit_type],
			total: (p) => [p.conduit_size.toString(), text(p.conduit_type)]
		}
	];
}

/** A 400Y/230 V panel also lists each circuit's phase and VA per phase (PEC 2017 App. D Ex. D6). */
function wyeGroups(): SheetGroup[] {
	return [
		{
			text: ' ',
			cols: 1,
			sub_cols: ['PHASE'],
			row: (l) => [l.phase],
			total: () => ['ABC']
		},
		{
			text: 'VA PER PHASE',
			cols: 3,
			sub_cols: [...PHASE_ASSIGNMENTS],
			row: (l) => PHASE_ASSIGNMENTS.map((phase) => rowPhaseVa(l, phase)),
			total: (p) =>
				PHASE_ASSIGNMENTS.map((phase) => Number((p.phase_va?.[phase] ?? 0).toFixed(2)).toString())
		}
	];
}

/** The supply line of the schedule header, e.g. "1P + E, 230V, 60Hz". */
function supplyDescription(phase: string | undefined): string {
	return phase === default_phases.THREE_PHASE_WYE
		? `${getOptionLabel(DEFAULT_PHASES, phase)} + N + E, 400Y/230V, 60Hz`
		: `${getOptionLabel(DEFAULT_PHASES, phase)} + E, ${230}V, ${60}Hz`;
}

/** Lookups built once per export and shared by every panel it writes. */
interface ExportTree {
	nodes_by_id: Map<string, Node>;
	context: LoadComputationContext;
}

/** Writes the schedule of `node_id` and every panel under it, one sheet per depth. */
export async function processExcelPanelBoardSchedule(
	workbook: ExcelJS.Workbook,
	node_id: string,
	highest_unit?: Node['highest_unit_form'],
	nodes: Node[] = [],
	is_dynamic = false
): Promise<ExportProcessResult> {
	// Built once: rebuilding them per panel scanned every node for every panel.
	const tree: ExportTree = {
		nodes_by_id: new Map(nodes.map((node) => [node.id, node])),
		context: { children_by_parent: buildChildrenByParent(nodes), is_dynamic, memo: new Map() }
	};
	const depth = getNodeDepthFromNodes(nodes, node_id);
	const result = await writePanelSchedule(workbook, node_id, depth, highest_unit, tree);
	// Once per sheet, after the whole tree: panels at one depth share a sheet, so
	// fitting it after each panel re-read a growing sheet per panel (quadratic).
	workbook.eachSheet((worksheet) => fitColumnWidths(worksheet));
	return result;
}

async function writePanelSchedule(
	workbook: ExcelJS.Workbook,
	node_id: string,
	depth: number,
	highest_unit: Node['highest_unit_form'] | undefined,
	tree: ExportTree
): Promise<ExportProcessResult> {
	const { nodes_by_id, context } = tree;
	const current_node = nodes_by_id.get(node_id);
	if (!current_node) {
		return { valid: false, message: 'Node not found', is_system_error: true };
	}
	const computed_current_node = computeNodeLoad(current_node, context);
	// One computed list serves both the load rows and the recursion into sub-panels.
	const loads = (context.children_by_parent.get(node_id) ?? []).map((child) =>
		computeNodeLoad(child, context)
	);

	const panel_level = getOrdinalSuffix(depth);
	const parent_node = current_node.parent_id ? nodes_by_id.get(current_node.parent_id) : undefined;
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
	// What this panel distributes: the project's supply at the root, else the panel's own phase.
	const panel_phase = supplyPhaseOf(current_node) ?? highest_unit?.phase;
	const groups =
		panel_phase === default_phases.THREE_PHASE_WYE
			? [...baseGroups().slice(0, 5), ...wyeGroups(), ...baseGroups().slice(5)]
			: baseGroups();
	worksheet.getCell(`B${startRow + 1}`).value = `: ${supplyDescription(panel_phase)}`;
	worksheet.getCell(`B${startRow + 2}`).value = `: ${from_supply_name}`;
	worksheet.getCell(`B${startRow + 3}`).value = `: ${panel_name}`;

	description_label_column_position_data
		.map((e) => e.column)
		.forEach((cell) => {
			worksheet.getCell(cell).font = { bold: true };
		});

	let current_header_column = 1;
	groups.forEach((header: Header) => {
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

	let current_load_row = startRow + 6;

	for (const load of loads) {
		const loadCells = groups.flatMap((group) => group.row(load));
		loadCells.forEach((value, index) => {
			const cell = worksheet.getCell(current_load_row, index + 1);
			cell.value = value;
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = { bottom: { style: 'thin' } };
		});
		current_load_row++;
	}

	const main_columns = groups.flatMap((group) => group.total(computed_current_node));

	main_columns.forEach((value, index) => {
		const cell = worksheet.getCell(current_load_row, index + 1);
		cell.value = value;
		cell.font = { bold: true };
		cell.alignment = { vertical: 'middle', horizontal: 'center' };
		cell.border = { top: { style: 'thin' }, bottom: { style: 'thick' } };
	});

	const emptyRow = worksheet.getRow(current_load_row + 2);
	emptyRow.height = 15;

	// Process children
	for (const child of loads) {
		if (child.node_type === 'root' || child.node_type === 'panel') {
			await writePanelSchedule(workbook, child.id, depth + 1, highest_unit, tree);
		}
	}

	return { valid: true };
}
