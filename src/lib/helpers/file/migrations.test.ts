import { describe, expect, it } from 'vitest';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants.js';
import type { FileExport } from '#lib/types/main.js';
import { migrateFileExport, needsPec2017Notice } from './migrations.js';

function createFileExport(): FileExport {
	return {
		project: {
			id: 'project',
			project_name: 'Legacy',
			settings: {},
			root_node_id: 'root'
		},
		nodes: [
			{
				id: 'root',
				node_type: 'root',
				child_ids: ['panel', 'load'],
				highest_unit_form: {
					distribution_unit: 'Transformer',
					phase: '1P'
				}
			},
			{
				id: 'panel',
				node_type: 'panel',
				parent_id: 'root',
				child_ids: [],
				panel_data: {
					name: 'LP-1',
					ambient_temperature: 30,
					terminal_temperature: 'Standard Temperature',
					phase: '3P-Y'
				}
			},
			{
				id: 'load',
				node_type: 'load',
				parent_id: 'root',
				child_ids: [],
				load_data: {
					load_description: '10 - Lighting',
					ambient_temperature: 30,
					terminal_temperature: 'Standard Temperature',
					quantity: 10,
					varies: '0',
					continuous: false,
					load_type: 'General Lighting',
					config_preference: 'CUSTOM'
				}
			}
		]
	};
}

describe('migrateFileExport', () => {
	it('replaces legacy labels with canonical values', () => {
		const migrated = migrateFileExport(createFileExport());

		expect(migrated.nodes[0].highest_unit_form?.phase).toBe(default_phases.ONE_PHASE);
		expect(migrated.nodes[1].panel_data?.phase).toBe(default_phases.THREE_PHASE_WYE);
		expect(migrated.nodes[1].panel_data?.terminal_temperature).toBe(STANDARD_TERMINAL_TEMPERATURE);
		expect(migrated.nodes[2].load_data?.terminal_temperature).toBe(STANDARD_TERMINAL_TEMPERATURE);
		expect(migrated.nodes[2].load_data?.load_type).toBe(default_load_types.GENERAL_LIGHTING);
	});

	it('keeps canonical values and node identity untouched', () => {
		const file_export = createFileExport();
		file_export.nodes[0].highest_unit_form!.phase = default_phases.ONE_PHASE;
		file_export.nodes[1].panel_data!.phase = default_phases.THREE_PHASE_WYE;
		file_export.nodes[1].panel_data!.terminal_temperature = STANDARD_TERMINAL_TEMPERATURE;
		file_export.nodes[2].load_data!.terminal_temperature = STANDARD_TERMINAL_TEMPERATURE;
		file_export.nodes[2].load_data!.load_type = default_load_types.GENERAL_LIGHTING;
		file_export.nodes[0].highest_unit_form!.pec_2017_sizing = true;

		const migrated = migrateFileExport(file_export);

		migrated.nodes.forEach((node, index) => expect(node).toBe(file_export.nodes[index]));
	});

	it('leaves unknown values for newer formats alone', () => {
		const file_export = createFileExport();
		file_export.nodes[1].panel_data!.phase = 'future_phase';
		file_export.nodes[2].load_data!.load_type = 'future_load';

		const migrated = migrateFileExport(file_export);

		expect(migrated.nodes[1].panel_data?.phase).toBe('future_phase');
		expect(migrated.nodes[2].load_data?.load_type).toBe('future_load');
	});

	it('rewrites untouched single-phase defaults in a 3P-Y file', () => {
		const file_export = createFileExport();
		file_export.nodes[0].highest_unit_form!.phase = '3P-Y';
		for (const node of file_export.nodes.slice(1)) {
			node.pole = '2';
			node.conductor_qty = 2;
		}
		const migrated = migrateFileExport(file_export);
		// LP-1 is a 3P-Y panel: 3-pole, 3 phase + neutral; the lighting load is 1P line-to-neutral.
		expect([migrated.nodes[1].pole, migrated.nodes[1].conductor_qty]).toEqual(['3', 4]);
		expect([migrated.nodes[2].pole, migrated.nodes[2].conductor_qty]).toEqual(['1', 2]);
		expect(migrated.nodes[0].pole).toBeUndefined();
	});

	it('rewrites 3P-Y defaults only once, so a later 2-pole pick survives reopening', () => {
		const file_export = createFileExport();
		file_export.nodes[0].highest_unit_form!.phase = default_phases.THREE_PHASE_WYE;
		const migrated = migrateFileExport(file_export);
		expect(migrated.nodes[0].highest_unit_form?.wye_circuit_defaults).toBe(true);

		// The user then picks 2-pole, 2 wires, saves and reopens.
		migrated.nodes[2].pole = '2';
		migrated.nodes[2].conductor_qty = 2;
		const reopened = migrateFileExport(migrated);
		expect([reopened.nodes[2].pole, reopened.nodes[2].conductor_qty]).toEqual(['2', 2]);
	});

	it('keeps poles a user changed in a 3P-Y file, and single-phase files as they are', () => {
		const wye = createFileExport();
		wye.nodes[0].highest_unit_form!.phase = default_phases.THREE_PHASE_WYE;
		wye.nodes[2].pole = '2';
		wye.nodes[2].conductor_qty = 3;
		expect(migrateFileExport(wye).nodes[2].pole).toBe('2');

		const single = createFileExport();
		single.nodes[2].pole = '2';
		single.nodes[2].conductor_qty = 2;
		expect(migrateFileExport(single).nodes[2].pole).toBe('2');
	});
});

describe('PEC 2017 sizing migration', () => {
	it('flags a pre-PEC file with circuits for the notice, then marks it once', () => {
		const file_export = createFileExport();
		expect(needsPec2017Notice(file_export)).toBe(true);

		const migrated = migrateFileExport(file_export);
		expect(migrated.nodes[0].highest_unit_form?.pec_2017_sizing).toBe(true);
		expect(needsPec2017Notice(migrated)).toBe(false);
	});

	it('maps old Appendix C conduit overrides to the PEC Table 10.1.1.4 trade sizes', () => {
		const file_export = createFileExport();
		file_export.nodes[1].overrided_conduit_size = 21;
		file_export.nodes[2].overrided_conduit_size = 155;

		const migrated = migrateFileExport(file_export);
		expect(migrated.nodes[1].overrided_conduit_size).toBe(20);
		expect(migrated.nodes[2].overrided_conduit_size).toBe(150);
	});

	it('maps conduit overrides only once, so a file already marked keeps its values', () => {
		const file_export = createFileExport();
		file_export.nodes[0].highest_unit_form!.pec_2017_sizing = true;
		file_export.nodes[1].overrided_conduit_size = 16;

		expect(migrateFileExport(file_export).nodes[1].overrided_conduit_size).toBe(16);
	});

	it('skips the notice for a file with only its root', () => {
		const file_export = createFileExport();
		file_export.nodes = [{ ...file_export.nodes[0], child_ids: [] }];
		expect(needsPec2017Notice(file_export)).toBe(false);
	});
});
