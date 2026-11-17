import { beforeAll, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants.js';
import { initializeDatabase } from '#lib/db/index.js';
import { addNode, createProject, resetData } from '#lib/db/mutations/index.js';
import { loadSnapshot } from '#lib/db/queries/snapshot.js';
import { processVoltageDropSheet } from './voltage-drop-sheet.js';
import type { Phase } from '#lib/types/phase.js';

beforeAll(async () => {
	await initializeDatabase();
});

async function sheetFor(system: Phase) {
	resetData();
	const created = await createProject('VD', { distribution_unit: 'Transformer', phase: system });
	addNode({
		parent_id: created!.root_node_id,
		load_data: {
			load_type: default_load_types.LIGHTING_LOAD,
			quantity: 1,
			varies: '1000',
			load_description: 'Lights',
			continuous: false,
			circuit_number: 1,
			length: 10,
			ambient_temperature: 30,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			config_preference: 'CUSTOM'
		} as never
	});
	const workbook = new ExcelJS.Workbook();
	await processVoltageDropSheet(workbook, loadSnapshot().nodes, false);
	const sheet = workbook.getWorksheet('Voltage Drop')!;
	return { headers: sheet.getRow(1).values as unknown[], row: sheet.getRow(3).values as unknown[] };
}

describe('processVoltageDropSheet', () => {
	it('keeps the single-phase layout', async () => {
		const { headers } = await sheetFor(default_phases.ONE_PHASE);
		expect(headers.slice(1, 4)).toEqual(['From NODE', 'To NODE', 'CABLE']);
	});

	it('names the phase and voltage of every run on a 3P-Y system (D15)', async () => {
		const { headers, row } = await sheetFor(default_phases.THREE_PHASE_WYE);
		expect(headers.slice(1, 6)).toEqual(['From NODE', 'To NODE', 'PHASE', 'VOLTAGE', 'CABLE']);
		// Circuit 1 defaults to phase A, line to neutral at 230 V.
		expect(row.slice(3, 5)).toEqual(['A', 230]);
	});
});
