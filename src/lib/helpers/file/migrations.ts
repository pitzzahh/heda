import {
	DEFAULT_LOAD_TYPES,
	DEFAULT_PHASES,
	DEFAULT_TERMINAL_TEMPERATURES,
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants/index.js';
import type { Node } from '#lib/types/db/index.js';
import type { FileExport } from '#lib/types/main/index.js';

// Old files stored labels; normalize to canonical values on load.
const LEGACY_PHASES: Record<string, string> = {
	'1P': default_phases.ONE_PHASE,
	'3P-Y': default_phases.THREE_PHASE_WYE,
	'3P-Δ': default_phases.THREE_PHASE_DELTA
};

const LEGACY_TERMINAL_TEMPERATURES: Record<string, string> = {
	'Standard Temperature': STANDARD_TERMINAL_TEMPERATURE
};

const LEGACY_LOAD_TYPES: Record<string, string> = {
	'Lighting Load': default_load_types.LIGHTING_LOAD,
	'Convenience Outlet': default_load_types.CONVENIENCE_OUTLET,
	'General Lighting': default_load_types.GENERAL_LIGHTING,
	'1P Motor - Rated Horse Power': default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER,
	'1P Motor - Rated Current': default_load_types.ONE_P_MOTOR__RATED_CURRENT,
	'Heating Equipment': default_load_types.HEATING_EQUIPMENT
};

const PHASE_VALUES = new Set<string>(DEFAULT_PHASES.map((option) => option.value));
const TERMINAL_TEMPERATURE_VALUES = new Set<string>(
	DEFAULT_TERMINAL_TEMPERATURES.map((option) => option.value)
);
const LOAD_TYPE_VALUES = new Set<string>(DEFAULT_LOAD_TYPES.map((option) => option.value));

function migrateValue(
	value: string,
	canonical_values: ReadonlySet<string>,
	legacy_values: Readonly<Record<string, string>>
): string {
	if (canonical_values.has(value)) return value;
	return legacy_values[value] ?? value;
}

function migratePhase(value: string): string {
	return migrateValue(value, PHASE_VALUES, LEGACY_PHASES);
}

function migrateTerminalTemperature(value: string): string {
	return migrateValue(value, TERMINAL_TEMPERATURE_VALUES, LEGACY_TERMINAL_TEMPERATURES);
}

function migrateLoadType(value: string): string {
	return migrateValue(value, LOAD_TYPE_VALUES, LEGACY_LOAD_TYPES);
}

function migrateNode(node: Node): Node {
	let changed = false;
	let panel_data = node.panel_data;
	let load_data = node.load_data;
	let highest_unit_form = node.highest_unit_form;

	if (panel_data) {
		const phase = migratePhase(panel_data.phase);
		const terminal_temperature = migrateTerminalTemperature(panel_data.terminal_temperature);
		if (phase !== panel_data.phase || terminal_temperature !== panel_data.terminal_temperature) {
			changed = true;
			panel_data = { ...panel_data, phase, terminal_temperature };
		}
	}

	if (load_data) {
		const terminal_temperature = migrateTerminalTemperature(load_data.terminal_temperature);
		const load_type = migrateLoadType(load_data.load_type);
		if (
			terminal_temperature !== load_data.terminal_temperature ||
			load_type !== load_data.load_type
		) {
			changed = true;
			load_data = { ...load_data, terminal_temperature, load_type };
		}
	}

	if (highest_unit_form?.phase) {
		const phase = migratePhase(highest_unit_form.phase);
		if (phase !== highest_unit_form.phase) {
			changed = true;
			highest_unit_form = { ...highest_unit_form, phase };
		}
	}

	return changed ? { ...node, panel_data, load_data, highest_unit_form } : node;
}

export function migrateFileExport(file_export: FileExport): FileExport {
	return { ...file_export, nodes: file_export.nodes.map(migrateNode) };
}
