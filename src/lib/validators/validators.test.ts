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
import { TITLE_BLOCK_SCHEMA } from './title-block.js';
import { SETTINGS_SCHEMA } from './settings.js';
import { BUTTON_STATE_FIELD, EXCEL_EXPORT_TYPE_FIELD } from './misc.js';
import {
	INTERRUPTING_RATING_STATUS_FIELD,
	SHORT_CIRCUIT_RESULT_SCHEMA,
	SHORT_CIRCUIT_SOURCE_SCHEMA
} from './short-circuit.js';
import { STANDBY_GENERATOR_SCHEMA } from './generator.js';
import { SOLAR_PV_SCHEMA } from './solar.js';
import {
	CIRCUIT_PHASE_FIELD,
	LINE_CURRENT_SCHEMA,
	PAIR_VA_SCHEMA,
	PHASE_ASSIGNMENT_FIELD,
	PHASE_VA_SCHEMA
} from './shared.js';
import { LOAD_SCHEDULE_ROW_SCHEMA, NODE_BY_ID_RESULT_SCHEMA } from './schedule.js';
import { VOLTAGE_DROP_RESULT_SCHEMA } from './voltage-drop.js';
import { FILE_EXPORT_SCHEMA, FILE_PROTECTION_FIELD, RECENT_PROJECT_SCHEMA } from './file.js';
import { OVERRIDE_FIELD_TYPE_FIELD } from './misc.js';
import { DEFAULT_LOAD_SCHEMA, DWELLING_CIRCUIT_FIELD, NAMEPLATE_CURRENT_FIELD } from './load.js';
import { DEFAULT_LOADS } from '#lib/constants.js';
import { COORDINATION_REFERENCE_SCHEMA } from './coordination.js';

describe('validators', () => {
	it('takes an optional, positive nameplate current (PEC 2017 4.30.3.2(A)(1))', () => {
		expect(v.safeParse(NAMEPLATE_CURRENT_FIELD, 31.6).success).toBe(true);
		expect(v.safeParse(NAMEPLATE_CURRENT_FIELD, undefined).success).toBe(true);
		expect(v.safeParse(NAMEPLATE_CURRENT_FIELD, 0).success).toBe(false);
		expect(v.safeParse(NAMEPLATE_CURRENT_FIELD, Number.NaN).success).toBe(false);
	});

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

	it('keeps a custom distribution unit name and falls back to Transformer when blank', () => {
		const name = (distribution_unit?: string) => {
			const result = v.safeParse(HIGHEST_UNIT_SCHEMA, {
				distribution_unit,
				phase: default_phases.ONE_PHASE
			});
			return result.success ? result.output.distribution_unit : null;
		};
		expect(name('  Main Switchboard ')).toBe('Main Switchboard');
		expect(name('')).toBe('Transformer');
		expect(name('   ')).toBe('Transformer');
		expect(name(undefined)).toBe('Transformer');
	});

	it('treats the supply as the utility service unless told otherwise (PEC 2017 2.30.6.10)', () => {
		const service = (is_service?: boolean) => {
			const result = v.safeParse(HIGHEST_UNIT_SCHEMA, {
				phase: default_phases.ONE_PHASE,
				is_service
			});
			return result.success ? result.output.is_service : null;
		};
		expect(service(undefined)).toBe(true);
		expect(service(false)).toBe(false);
	});

	it('takes a project as no small dwelling unless told so (PEC 2017 1.3.1.1(C), 2.30.6.10(B))', () => {
		const dwelling = (small_dwelling?: boolean) => {
			const result = v.safeParse(HIGHEST_UNIT_SCHEMA, {
				phase: default_phases.ONE_PHASE,
				small_dwelling
			});
			return result.success ? result.output.small_dwelling : null;
		};
		expect(dwelling(undefined)).toBe(false);
		expect(dwelling(true)).toBe(true);
	});

	it('trims an optional project name and caps its length', () => {
		const parse = (project_name?: string) =>
			v.safeParse(HIGHEST_UNIT_SCHEMA, { phase: default_phases.ONE_PHASE, project_name });
		const output = (project_name?: string) => {
			const result = parse(project_name);
			return result.success ? result.output.project_name : null;
		};
		expect(output('  Mall expansion ')).toBe('Mall expansion');
		expect(output('')).toBe('');
		expect(output(undefined)).toBeUndefined();
		expect(output('a'.repeat(100))).toBe('a'.repeat(100));
		const too_long = parse('a'.repeat(101));
		expect(too_long.success).toBe(false);
		if (!too_long.success) {
			expect(too_long.issues[0].path?.[0].key).toBe('project_name');
		}
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

	it('validates the short-circuit source (PEC 2017 App. D Ex. D14)', () => {
		const d14 = { utility_sc_kva: 1_000_000, transformer_kva: 300, transformer_z_percent: 5 };
		expect(v.safeParse(SHORT_CIRCUIT_SOURCE_SCHEMA, d14).success).toBe(true);
		expect(
			v.safeParse(SHORT_CIRCUIT_SOURCE_SCHEMA, { ...d14, transformer_z_percent: 100 }).success
		).toBe(true);
		for (const invalid of [
			{ ...d14, utility_sc_kva: 0 },
			{ ...d14, transformer_kva: -300 },
			{ ...d14, transformer_z_percent: 0 },
			{ ...d14, transformer_z_percent: 100.1 },
			{ ...d14, transformer_kva: '300' },
			{ utility_sc_kva: 1_000_000, transformer_kva: 300 }
		]) {
			expect(v.safeParse(SHORT_CIRCUIT_SOURCE_SCHEMA, invalid).success).toBe(false);
		}
	});

	it('takes an optional, positive standby generator rating', () => {
		expect(v.safeParse(STANDBY_GENERATOR_SCHEMA, {}).success).toBe(true);
		expect(v.safeParse(STANDBY_GENERATOR_SCHEMA, { generator_kva: 25 }).success).toBe(true);
		for (const generator_kva of [0, -5, '25']) {
			expect(v.safeParse(STANDBY_GENERATOR_SCHEMA, { generator_kva }).success).toBe(false);
		}
	});

	it('takes a solar PV system field by field (PEC 2017 6.90.2.1, Table 6.90.2.1(A))', () => {
		expect(v.safeParse(SOLAR_PV_SCHEMA, {}).success).toBe(true);
		const pv = {
			module_voc: 49.5,
			module_isc: 13.9,
			modules_per_string: 10,
			strings: 2,
			lowest_ambient: -40,
			building: 'one_two_family',
			inverter_current: 22,
			panel: 'MDP',
			busbar_rating: 100,
			center_fed: false,
			supply_side: false,
			on_feeder: true,
			dc_ambient: 34,
			near_roof: true,
			module_max_ocpd: 25,
			strings_per_raceway: 2,
			inverter_backfeed: 0,
			inverter_ambient: 40,
			engineered_busbar: false
		};
		expect(v.safeParse(SOLAR_PV_SCHEMA, pv).success).toBe(true);
		for (const invalid of [
			{ module_voc: 0 },
			{ module_isc: -1 },
			{ modules_per_string: 2.5 },
			{ strings: 0 },
			// Table 6.90.2.1(A) has no factor below −40 °C.
			{ lowest_ambient: -41 },
			{ inverter_current: '22' },
			{ busbar_rating: 0 },
			{ center_fed: 'yes' },
			{ building: 'dwelling' },
			{ supply_side: 1 },
			{ on_feeder: 'no' },
			{ dc_ambient: '34' },
			{ near_roof: 0 },
			{ module_max_ocpd: 0 },
			{ strings_per_raceway: 1.5 },
			{ inverter_backfeed: -1 },
			{ inverter_ambient: '40' },
			{ engineered_busbar: 'yes' }
		]) {
			expect(v.safeParse(SOLAR_PV_SCHEMA, { ...pv, ...invalid }).success).toBe(false);
		}
	});

	it('keeps the source optional on stored root nodes but validates it when present', () => {
		const root = { id: 'r', node_type: 'root', child_ids: [] };
		expect(
			v.safeParse(NODE_DOC_SCHEMA, { ...root, highest_unit_form: { phase: 'one_phase' } }).success
		).toBe(true);
		expect(
			v.safeParse(NODE_DOC_SCHEMA, { ...root, highest_unit_form: { transformer_kva: 0 } }).success
		).toBe(false);
	});

	it('stores the small-dwelling flag (PEC 2017 2.10.1.11(C)(5), 2.30.6.10(B)) as a boolean', () => {
		const root = { id: 'r', node_type: 'root', child_ids: [] };
		const parse = (small_dwelling: unknown) =>
			v.safeParse(NODE_DOC_SCHEMA, { ...root, highest_unit_form: { small_dwelling } }).success;
		expect(parse(true)).toBe(true);
		expect(parse(undefined)).toBe(true);
		expect(parse('yes')).toBe(false);
	});

	it('describes short-circuit rows and their status', () => {
		expect(v.safeParse(INTERRUPTING_RATING_STATUS_FIELD, 'under_rated').success).toBe(true);
		expect(v.safeParse(INTERRUPTING_RATING_STATUS_FIELD, 'unknown').success).toBe(false);
		const row = {
			from_node_name: 'Transformer',
			to_node_name: 'LP-1',
			length: 20,
			conductor_z_ohm: 0.0645,
			conductor_z_pu: 0.1219,
			motor_z_pu: null,
			supply_z_pu: 0.0251,
			supply_fault_current: 17_322,
			node_fault_current: 2_959,
			interrupting_rating_ka: 5,
			status: 'under_rated'
		};
		expect(v.safeParse(SHORT_CIRCUIT_RESULT_SCHEMA, row).success).toBe(true);
		expect(
			v.safeParse(SHORT_CIRCUIT_RESULT_SCHEMA, { ...row, supply_fault_current: undefined }).success
		).toBe(false);
	});

	it('validates 3P-Y phases and delta line pairs', () => {
		for (const phase of ['A', 'B', 'C', 'AB', 'BC', 'CA']) {
			expect(v.safeParse(PHASE_ASSIGNMENT_FIELD, phase).success).toBe(true);
			expect(v.safeParse(CIRCUIT_PHASE_FIELD, phase).success).toBe(true);
		}
		expect(v.safeParse(PHASE_ASSIGNMENT_FIELD, 'ABC').success).toBe(false);
		expect(v.safeParse(PHASE_ASSIGNMENT_FIELD, 'BA').success).toBe(false);
		expect(v.safeParse(PAIR_VA_SCHEMA, { AB: 1, BC: 2, CA: 3 }).success).toBe(true);
		expect(v.safeParse(PAIR_VA_SCHEMA, { A: 1, B: 2, C: 3 }).success).toBe(false);
		expect(v.safeParse(LINE_CURRENT_SCHEMA, { A: 1, B: 2, C: 3 }).success).toBe(true);
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
			conduit_size: 16,
			ampere_frames: 30,
			phase: 'ABC',
			phase_va: { A: 1, B: 1, C: 1 },
			balanced_current: 1.4,
			unbalance: 0,
			ampacity: 261.12
		};
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, row).success).toBe(true);
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, { ...row, unbalance: '0' }).success).toBe(false);
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, { ...row, ampacity: null }).success).toBe(false);
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, { ...row, phase: 'Z' }).success).toBe(false);
		const one_phase_row = { ...row, phase: 'B', phase_loads: [null, 1000, null] };
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, one_phase_row).success).toBe(true);
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, { ...row, phase_loads: [1, 1] }).success).toBe(
			false
		);
		const delta_row = {
			...row,
			voltage: 230,
			phase_va: undefined,
			pair_va: { AB: 1, BC: 1, CA: 1 },
			line_current: { A: 1, B: 1, C: 1 }
		};
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, delta_row).success).toBe(true);
		expect(v.safeParse(LOAD_SCHEDULE_ROW_SCHEMA, { ...row, phase: 'CA' }).success).toBe(true);
		expect(
			v.safeParse(NODE_BY_ID_RESULT_SCHEMA, { ...row, egc_size: 'error', conduit_size: '16' })
				.success
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
		// The four PEC 2017 2.10.1.11(C) dwelling circuits, and nothing else.
		for (const circuit of ['small_appliance', 'laundry', 'bathroom', 'garage']) {
			expect(v.safeParse(DWELLING_CIRCUIT_FIELD, circuit).success).toBe(true);
		}
		expect(v.safeParse(DWELLING_CIRCUIT_FIELD, 'kitchen').success).toBe(false);
		// Every shipped preset parses; 2.20.3.13 gives the small-appliance and laundry
		// circuits 1500 VA, 2.20.2.5(J)(1) bathroom and garage none beyond general lighting.
		for (const preset of DEFAULT_LOADS) {
			expect(v.safeParse(DEFAULT_LOAD_SCHEMA, preset).success).toBe(true);
		}
		expect(
			DEFAULT_LOADS.filter((preset) => preset.dwelling_circuit).map((preset) => preset.varies)
		).toEqual(['1500', '1500', '0', '0']);
		expect(v.safeParse(OVERRIDE_FIELD_TYPE_FIELD, 'z').success).toBe(true);
		expect(v.safeParse(OVERRIDE_FIELD_TYPE_FIELD, 'va').success).toBe(false);
	});

	describe('TITLE_BLOCK_SCHEMA (PEC 2017 1.3.2.2)', () => {
		it('trims the title block and keeps it on the project', () => {
			const result = v.safeParse(TITLE_BLOCK_SCHEMA, {
				engineer_name: '  Juan Dela Cruz, PEE ',
				prc_license_number: '0001234',
				sheet_size: '760x1000'
			});
			expect(result.success && result.output.engineer_name).toBe('Juan Dela Cruz, PEE');
			expect(
				v.safeParse(PROJECT_DOC_SCHEMA, {
					id: 'p1',
					settings: {},
					root_node_id: 'n1',
					title_block: { location: 'Cebu City' }
				}).success
			).toBe(true);
		});

		it('takes only the PEC 2017 1.3.1.1 sheet sizes', () => {
			for (const sheet_size of ['760x1000', '600x900', '500x760', 'A3']) {
				expect(v.safeParse(TITLE_BLOCK_SCHEMA, { sheet_size }).success).toBe(true);
			}
			expect(v.safeParse(TITLE_BLOCK_SCHEMA, { sheet_size: 'A4' }).success).toBe(false);
			expect(v.safeParse(TITLE_BLOCK_SCHEMA, { tin: 'x'.repeat(121) }).success).toBe(false);
		});
	});
});

describe('selective coordination (PEC 2017 7.0.6.3)', () => {
	const panel = {
		name: 'EP',
		circuit_number: 1,
		ambient_temperature: 30,
		length: 10,
		terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
		phase: default_phases.ONE_PHASE
	};

	it('marks a panel as a listed system, or none for a normal panel', () => {
		const parse = (system: unknown) =>
			v.safeParse(GENERIC_PHASE_PANEL_SCHEMA, { ...panel, system });
		expect(parse('emergency').output).toMatchObject({ system: 'emergency' });
		expect(parse('critical_operations_data').success).toBe(true);
		expect(parse(null).output).toMatchObject({ system: null });
		expect(v.safeParse(GENERIC_PHASE_PANEL_SCHEMA, panel).output).not.toHaveProperty('system');
		expect(parse('optional_standby').success).toBe(false);
	});

	it('trims the documented reference and bounds its length', () => {
		expect(v.safeParse(COORDINATION_REFERENCE_SCHEMA, { reference: '  Table 4  ' }).output).toEqual(
			{
				reference: 'Table 4'
			}
		);
		expect(v.safeParse(COORDINATION_REFERENCE_SCHEMA, {}).output).toEqual({ reference: '' });
		expect(v.safeParse(COORDINATION_REFERENCE_SCHEMA, { reference: 'x'.repeat(201) }).success).toBe(
			false
		);
	});
});
