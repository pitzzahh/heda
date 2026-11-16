import { describe, expect, it } from 'vitest';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants.js';
import * as v from 'valibot';
import { HIGHEST_UNIT_SCHEMA } from './index.js';
import {
	GENERIC_PHASE_MAIN_LOAD_SCHEMA,
	QUANTITY_LABEL_FIELD,
	VARIES_LABEL_FIELD
} from './load.js';
import { GENERIC_PHASE_PANEL_SCHEMA } from './panel.js';
import { NODE_DOC_SCHEMA, PROJECT_DOC_SCHEMA } from './db.js';
import { SETTINGS_SCHEMA } from './settings.js';
import { BUTTON_STATE_FIELD, EXCEL_EXPORT_TYPE_FIELD } from './misc.js';
import { CIRCUIT_PHASE_FIELD, PHASE_ASSIGNMENT_FIELD, PHASE_VA_SCHEMA } from './shared.js';
import {
	COMPUTE_COMMON_PROPERTIES_SCHEMA,
	LOAD_SCHEDULE_ROW_SCHEMA,
	NODE_BY_ID_RESULT_SCHEMA
} from './schedule.js';
import { VOLTAGE_DROP_RESULT_SCHEMA } from './voltage-drop.js';
import { FILE_EXPORT_SCHEMA, FILE_PROTECTION_FIELD, RECENT_PROJECT_SCHEMA } from './file.js';
import {
	EXPORT_HEADER_SCHEMA,
	EXPORT_PROCESS_RESULT_SCHEMA,
	OVERRIDE_FIELD_TYPE_FIELD
} from './misc.js';
import { DEFAULT_LOAD_SCHEMA } from './load.js';

describe('validators', () => {
	it('accepts valid inputs', () => {
		expect(
			v.safeParse(HIGHEST_UNIT_SCHEMA, {
				distribution_unit: 'Transformer',
				phase: default_phases.ONE_PHASE,
				password: 'correct-horse',
				confirm_password: 'correct-horse'
			}).success
		).toBe(true);
		expect(
			v.safeParse(HIGHEST_UNIT_SCHEMA, {
				distribution_unit: 'Transformer',
				phase: default_phases.ONE_PHASE
			}).success
		).toBe(true);
		expect(
			v.safeParse(SETTINGS_SCHEMA, {
				color: 'excel',
				font: 'default',
				theme_mode: 'light',
				show_loads_on_unit_hierarchy: false,
				is_adjustment_factor_dynamic: false,
				is_panel_multi_copy: false,
				is_load_multi_copy: false,
				auto_save_enabled: false,
				backup_project_file_if_exists: false
			}).success
		).toBe(true);
		expect(
			v.safeParse(GENERIC_PHASE_PANEL_SCHEMA, {
				name: 'LP-1',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}).success
		).toBe(true);
		expect(
			v.safeParse(GENERIC_PHASE_MAIN_LOAD_SCHEMA, {
				circuit_number: 1,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				ambient_temperature: 30,
				length: 10,
				quantity: 2,
				load_description: 'Lighting Outlet',
				varies: '50',
				continuous: true,
				load_type: default_load_types.LIGHTING_LOAD
			}).success
		).toBe(true);
		expect(
			v.safeParse(PROJECT_DOC_SCHEMA, { id: 'p1', settings: {}, root_node_id: 'n1' }).success
		).toBe(true);
		expect(
			v.safeParse(NODE_DOC_SCHEMA, { id: 'n1', node_type: 'root', child_ids: [] }).success
		).toBe(true);
		expect(v.safeParse(VARIES_LABEL_FIELD, 'Unit Wattage').success).toBe(true);
		expect(v.safeParse(QUANTITY_LABEL_FIELD, 'Floor area').success).toBe(true);
		expect(v.safeParse(BUTTON_STATE_FIELD, 'loading').success).toBe(true);
		expect(v.safeParse(EXCEL_EXPORT_TYPE_FIELD, 'VOLTAGE_DROP').success).toBe(true);
	});

	it('rejects invalid inputs', () => {
		expect(v.safeParse(HIGHEST_UNIT_SCHEMA, { distribution_unit: '', phase: '9P' }).success).toBe(
			false
		);
		const mismatch = v.safeParse(HIGHEST_UNIT_SCHEMA, {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE,
			password: 'correct-horse',
			confirm_password: 'different-horse'
		});
		expect(mismatch.success).toBe(false);
		if (!mismatch.success) {
			expect(mismatch.issues.some((i) => i.path?.some((p) => p.key === 'confirm_password'))).toBe(
				true
			);
		}
		expect(
			v.safeParse(HIGHEST_UNIT_SCHEMA, {
				distribution_unit: 'Transformer',
				phase: default_phases.ONE_PHASE,
				password: 'short',
				confirm_password: 'short'
			}).success
		).toBe(false);
		expect(
			v.safeParse(GENERIC_PHASE_PANEL_SCHEMA, {
				name: '',
				circuit_number: 0,
				length: 10,
				phase: default_phases.ONE_PHASE
			}).success
		).toBe(false);
		expect(
			v.safeParse(GENERIC_PHASE_MAIN_LOAD_SCHEMA, {
				circuit_number: 0,
				length: 10,
				quantity: 0,
				load_description: '',
				varies: 'abc',
				continuous: true,
				load_type: default_load_types.LIGHTING_LOAD
			}).success
		).toBe(false);
		expect(v.safeParse(VARIES_LABEL_FIELD, 'nope').success).toBe(false);
		expect(v.safeParse(NODE_DOC_SCHEMA, { id: 'n1' }).success).toBe(false);
	});

	it('requires a password when protection is on', () => {
		const missing = v.safeParse(HIGHEST_UNIT_SCHEMA, {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE,
			use_password: true
		});
		expect(missing.success).toBe(false);
		if (!missing.success) {
			expect(missing.issues.some((i) => i.path?.some((p) => p.key === 'password'))).toBe(true);
		}
		expect(
			v.safeParse(HIGHEST_UNIT_SCHEMA, {
				distribution_unit: 'Transformer',
				phase: default_phases.ONE_PHASE,
				use_password: true,
				password: 'correct-horse',
				confirm_password: 'correct-horse'
			}).success
		).toBe(true);
	});

	it('applies schema defaults for optional fields', () => {
		const panel = v.safeParse(GENERIC_PHASE_PANEL_SCHEMA, {
			name: 'LP-1',
			circuit_number: 1,
			length: 10,
			phase: default_phases.ONE_PHASE
		});
		expect(panel.success).toBe(true);
		if (panel.success) {
			expect(panel.output.ambient_temperature).toBe(30);
			expect(panel.output.terminal_temperature).toBe(STANDARD_TERMINAL_TEMPERATURE);
		}
	});

	it('validates 3P-Y phases', () => {
		for (const phase of ['A', 'B', 'C']) {
			expect(v.safeParse(PHASE_ASSIGNMENT_FIELD, phase).success).toBe(true);
		}
		expect(v.safeParse(PHASE_ASSIGNMENT_FIELD, 'ABC').success).toBe(false);
		expect(v.safeParse(CIRCUIT_PHASE_FIELD, 'ABC').success).toBe(true);
		expect(v.safeParse(CIRCUIT_PHASE_FIELD, 'D').success).toBe(false);
		expect(v.safeParse(PHASE_VA_SCHEMA, { A: 1, B: 2, C: 3 }).success).toBe(true);
		expect(v.safeParse(PHASE_VA_SCHEMA, { A: 1, B: 2 }).success).toBe(false);
		const root = { id: 'n', node_type: 'load', child_ids: [] };
		expect(v.safeParse(NODE_DOC_SCHEMA, { ...root, phase_assignment: 'B' }).success).toBe(true);
		expect(v.safeParse(NODE_DOC_SCHEMA, { ...root, phase_assignment: 'X' }).success).toBe(false);
	});

	it('accepts a 3P motor picked by horsepower and requires a number otherwise', () => {
		const load = {
			circuit_number: 1,
			length: 10,
			quantity: 1,
			load_description: 'Pump',
			varies: '25',
			continuous: false,
			load_type: default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER
		};
		expect(v.safeParse(GENERIC_PHASE_MAIN_LOAD_SCHEMA, load).success).toBe(true);
		expect(
			v.safeParse(GENERIC_PHASE_MAIN_LOAD_SCHEMA, {
				...load,
				load_type: default_load_types.THREE_P_EQUIPMENT,
				varies: 'six'
			}).success
		).toBe(false);
	});

	it('describes computed schedule, voltage-drop and node rows', () => {
		const row = {
			circuit_number: 1,
			load_description: 'MDP',
			voltage: 400,
			va: 1000,
			current: 2,
			at: 30,
			conductor_size: 3.5,
			egc_size: 2,
			adjusted_current: 2,
			conduit_size: 16,
			ampere_frames: 30,
			phase: 'ABC',
			phase_va: { A: 1, B: 1, C: 1 },
			balanced_current: 1.4
		};
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, row).success).toBe(true);
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, { ...row, phase: 'Z' }).success).toBe(false);
		expect(
			v.safeParse(NODE_BY_ID_RESULT_SCHEMA, { ...row, egc_size: 'error', conduit_size: '16' })
				.success
		).toBe(true);
		expect(
			v.safeParse(COMPUTE_COMMON_PROPERTIES_SCHEMA, {
				va: 1,
				current: 1,
				conductor_set: 1,
				conductor_qty: 2,
				load_type: 'Main',
				ambient_temp: 30
			}).success
		).toBe(true);
		expect(
			v.safeParse(VOLTAGE_DROP_RESULT_SCHEMA, {
				from_node_name: 'Transformer',
				to_node_name: 'LP-1',
				z: 0.044,
				length: 10,
				actual_z: 0.0014,
				voltage_per_segment: 0.01,
				voltage_at_end_circuit: 0.01,
				voltage_at_receiving_end: 229.99,
				percent_voltage_drop: 0.0043
			}).success
		).toBe(true);
	});

	it('describes files, recent projects, presets and export helpers', () => {
		expect(v.safeParse(FILE_PROTECTION_FIELD, 'device').success).toBe(true);
		expect(v.safeParse(FILE_PROTECTION_FIELD, 'none').success).toBe(false);
		expect(
			v.safeParse(FILE_EXPORT_SCHEMA, {
				project: { id: 'p', settings: {}, root_node_id: 'r' },
				nodes: [{ id: 'r', node_type: 'root', child_ids: [] }]
			}).success
		).toBe(true);
		expect(
			v.safeParse(RECENT_PROJECT_SCHEMA, {
				id: 'p',
				project_name: 'Plant',
				project_path: '/tmp/plant.heda',
				exists: true
			}).success
		).toBe(true);
		expect(
			v.safeParse(DEFAULT_LOAD_SCHEMA, {
				description: 'Lights',
				varies: '28',
				continuous: true,
				type: default_load_types.GENERAL_LIGHTING
			}).success
		).toBe(true);
		expect(v.safeParse(OVERRIDE_FIELD_TYPE_FIELD, 'z').success).toBe(true);
		expect(v.safeParse(OVERRIDE_FIELD_TYPE_FIELD, 'va').success).toBe(false);
		expect(v.safeParse(EXPORT_PROCESS_RESULT_SCHEMA, { valid: true }).success).toBe(true);
		expect(
			v.safeParse(EXPORT_HEADER_SCHEMA, { text: 'CONDUIT', cols: 2, sub_cols: ['Size', 'Type'] })
				.success
		).toBe(true);
	});
});
