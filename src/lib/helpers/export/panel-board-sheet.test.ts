import { beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants.js';
import { initializeDatabase } from '#lib/db/index.js';
import { addNode, createProject, resetData } from '#lib/db/mutations/index.js';
import { getExportInputs } from '#lib/db/queries/export.js';
import { processExcelPanelBoardSchedule } from './panel-board-sheet.js';
import type { Phase } from '#lib/types/phase.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel.js';

beforeAll(async () => {
	await initializeDatabase();
});

const panel = (name: string, circuit_number: number, phase: Phase): GenericPhasePanelSchema => ({
	name,
	circuit_number,
	ambient_temperature: 30,
	length: 10,
	terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
	phase
});
const load = (circuit_number: number, load_type: string, varies: string) =>
	({
		load_type,
		quantity: 1,
		varies,
		load_description: `Load ${circuit_number}`,
		continuous: false,
		circuit_number,
		length: 10,
		ambient_temperature: 30,
		terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
		config_preference: 'CUSTOM'
	}) as never;

async function sheetFor(system: Phase, panel_phase: Phase, loads: [string, string][]) {
	resetData();
	const created = await createProject('Export', {
		distribution_unit: 'Transformer',
		phase: system
	});
	const root = created!.root_node_id;
	const lp = addNode({ parent_id: root, panel_data: panel('LP-1', 1, panel_phase) })!;
	loads.forEach(([type, varies], index) =>
		addNode({ parent_id: lp.id, load_data: load(index * 2 + 1, type, varies) })
	);
	const workbook = new ExcelJS.Workbook();
	const inputs = await getExportInputs('LOAD_SCHEDULE');
	const result = await processExcelPanelBoardSchedule(
		workbook,
		lp.id,
		inputs.nodes.find((node) => node.node_type === 'root')!.highest_unit_form,
		inputs
	);
	expect(result.valid).toBe(true);
	return workbook.getWorksheet('2nd')!;
}

const rowValues = (sheet: ExcelJS.Worksheet, row: number) =>
	(sheet.getRow(row).values as unknown[]).slice(1);

describe('panel board sheet', () => {
	it('keeps the single-phase layout', async () => {
		const sheet = await sheetFor(default_phases.ONE_PHASE, default_phases.ONE_PHASE, [
			[default_load_types.LIGHTING_LOAD, '1840']
		]);
		expect(sheet.getCell('B2').value).toBe(': 1P + E, 230V, 60Hz');
		expect(rowValues(sheet, 6)).toEqual([
			'CRKT NO.',
			'LOAD DESCRIPTION',
			'VOLTAGE (V)',
			'APPARENT POWER (VA)',
			'CURRENT (A)',
			'AT',
			'AF',
			'Pole',
			'KAIC',
			'Sets',
			'Qty',
			'Size (mm2)',
			'Insulation',
			'Size',
			'Insulation',
			'Size',
			'Type'
		]);
		const [ckt, description, voltage, va, current, , , pole] = rowValues(sheet, 7);
		expect([ckt, description, voltage, va, current, pole]).toEqual([
			1,
			'Load 1',
			230,
			1840,
			8,
			'2'
		]);
		expect(rowValues(sheet, 8).slice(0, 5)).toEqual(['TOTAL', 'MAIN', '230', '1840', '8']);
	});

	it('adds phase and VA per phase for a 400Y/230 V panel (PEC 2017 App. D Ex. D6)', async () => {
		const sheet = await sheetFor(default_phases.THREE_PHASE_WYE, default_phases.THREE_PHASE_WYE, [
			[default_load_types.LIGHTING_LOAD, '1840'], // ckt 1 → A
			[default_load_types.THREE_P_EQUIPMENT, '6000'] // ckt 3 → ABC, 2 000 VA each
		]);
		expect(sheet.getCell('B2').value).toBe(': 3P-Y + N + E, 400Y/230V, 60Hz');
		expect(rowValues(sheet, 5).slice(0, 7)).toEqual([' ', ' ', ' ', ' ', ' ', ' ', 'VA PER PHASE']);
		expect(rowValues(sheet, 6).slice(4, 10)).toEqual(['CURRENT (A)', 'PHASE', 'A', 'B', 'C', 'AT']);
		expect(rowValues(sheet, 7).slice(0, 9)).toEqual([1, 'Load 1', 230, 1840, 8, 'A', 1840, '', '']);
		expect(rowValues(sheet, 8).slice(5, 9)).toEqual(['ABC', 2000, 2000, 2000]);
		const total = rowValues(sheet, 9);
		expect(total.slice(0, 3)).toEqual(['TOTAL', 'MAIN', '400']);
		expect(total.slice(5, 9)).toEqual(['ABC', '3840', '2000', '2000']);
		// Most loaded phase (A, 3 840 VA ÷ 230 V) beats the balanced 7 840 VA ÷ 692.8 V.
		expect(total[4]).toBe('16.7');
	});

	it('adds phase and VA per line pair for a 230 V delta panel (PEC 2017 App. D Ex. D14)', async () => {
		const sheet = await sheetFor(
			default_phases.THREE_PHASE_DELTA,
			default_phases.THREE_PHASE_DELTA,
			[
				[default_load_types.LIGHTING_LOAD, '2300'], // ckt 1 → AB, 10 A line to line
				[default_load_types.THREE_P_EQUIPMENT, '6000'] // ckt 3 → ABC, 2 000 VA each pair
			]
		);
		expect(sheet.getCell('B2').value).toBe(': 3P-Δ + E, 230V, 60Hz');
		expect(rowValues(sheet, 5).slice(0, 7)).toEqual([
			' ',
			' ',
			' ',
			' ',
			' ',
			' ',
			'VA PER LINE PAIR'
		]);
		expect(rowValues(sheet, 6).slice(4, 9)).toEqual(['CURRENT (A)', 'PHASE', 'AB', 'BC', 'CA']);
		const [ckt, , voltage, va, current, phase, ab, bc, ca, , , pole] = rowValues(sheet, 7);
		expect([ckt, voltage, va, current, phase, ab, bc, ca, pole]).toEqual([
			1,
			230,
			2300,
			10,
			'AB',
			2300,
			'',
			'',
			'2'
		]);
		const total = rowValues(sheet, 9);
		expect(total.slice(0, 3)).toEqual(['TOTAL', 'MAIN', '230']);
		expect(total.slice(5, 9)).toEqual(['ABC', '4300', '2000', '2000']);
	});
});
