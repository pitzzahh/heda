import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { HIGHEST_UNIT_SCHEMA } from './index';
import {
	GENERIC_PHASE_MAIN_LOAD_SCHEMA,
	QUANTITY_LABEL_FIELD,
	VARIES_LABEL_FIELD
} from './load/index';
import { GENERIC_PHASE_PANEL_SCHEMA } from './panel/index';
import { NODE_DOC_SCHEMA, PROJECT_DOC_SCHEMA } from './db';
import { SETTINGS_SCHEMA } from './settings';
import { BUTTON_STATE_FIELD, EXCEL_EXPORT_TYPE_FIELD } from './misc';

describe('validators', () => {
	it('accepts valid inputs', () => {
		expect(
			v.safeParse(HIGHEST_UNIT_SCHEMA, {
				distribution_unit: 'Transformer',
				phase: '1P',
				password: 'correct-horse',
				confirm_password: 'correct-horse'
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
				terminal_temperature: 'Standard Temperature',
				phase: '1P'
			}).success
		).toBe(true);
		expect(
			v.safeParse(GENERIC_PHASE_MAIN_LOAD_SCHEMA, {
				circuit_number: 1,
				terminal_temperature: 'Standard Temperature',
				ambient_temperature: 30,
				length: 10,
				quantity: 2,
				load_description: 'Lighting Outlet',
				varies: '50',
				continuous: true,
				load_type: 'Lighting Load'
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
			phase: '1P',
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
				phase: '1P',
				password: 'short',
				confirm_password: 'short'
			}).success
		).toBe(false);
		expect(
			v.safeParse(GENERIC_PHASE_PANEL_SCHEMA, {
				name: '',
				circuit_number: 0,
				length: 10,
				phase: '1P'
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
				load_type: 'Lighting Load'
			}).success
		).toBe(false);
		expect(v.safeParse(VARIES_LABEL_FIELD, 'nope').success).toBe(false);
		expect(v.safeParse(NODE_DOC_SCHEMA, { id: 'n1' }).success).toBe(false);
	});

	it('applies schema defaults for optional fields', () => {
		const panel = v.safeParse(GENERIC_PHASE_PANEL_SCHEMA, {
			name: 'LP-1',
			circuit_number: 1,
			length: 10,
			phase: '1P'
		});
		expect(panel.success).toBe(true);
		if (panel.success) {
			expect(panel.output.ambient_temperature).toBe(30);
			expect(panel.output.terminal_temperature).toBe('Standard Temperature');
		}
	});
});
