import { describe, expect, it } from 'vitest';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants/index.js';
import type { FileExport } from '#lib/types/main/index.js';
import { migrateFileExport } from './migrations.js';

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
});
