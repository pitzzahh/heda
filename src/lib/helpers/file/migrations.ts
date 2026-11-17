import {
	DEFAULT_LOAD_TYPES,
	DEFAULT_PHASES,
	DEFAULT_TERMINAL_TEMPERATURES,
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants.js';
import type { Node } from '#lib/types/db.js';
import type { FileExport } from '#lib/types/main.js';
import { circuitDefaults } from '#lib/db/mutations/defaults.js';

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

/**
 * 3P-Y roots could be created in late 2024, before three-phase support; their
 * circuits kept the single-phase defaults (2-pole, 2 conductors). Rewrite those
 * untouched defaults to the 400Y/230 V ones (see `circuitDefaults`).
 */
function migrateWyeDefaults(nodes: Node[]): Node[] {
	const root_form = nodes.find((node) => node.node_type === 'root')?.highest_unit_form;
	const system_phase = root_form?.phase;
	// Once only: after it, 2-pole/2-wire on a 3P-Y file is the user's own choice.
	if (system_phase !== default_phases.THREE_PHASE_WYE || root_form?.wye_circuit_defaults) {
		return nodes;
	}
	return nodes.map((node) =>
		node.node_type === 'root'
			? { ...node, highest_unit_form: { ...node.highest_unit_form, wye_circuit_defaults: true } }
			: node.pole === '2' && node.conductor_qty === 2
				? { ...node, ...circuitDefaults(node, system_phase) }
				: node
	);
}

// Conduit overrides saved before the PEC 2017 audit used the Appendix C metric designators;
// each maps to the same trade size under its PEC 2017 Table 10.1.1.4 raceway size.
const LEGACY_CONDUIT_SIZES: Record<number, number> = {
	16: 15,
	21: 20,
	27: 25,
	35: 32,
	41: 40,
	53: 50,
	63: 65,
	78: 80,
	91: 90,
	103: 100,
	128: 130,
	129: 130,
	155: 150
};

/**
 * A file saved before the PEC 2017 sizing tables (breaker ratings, 38 mm² at 60°C,
 * heating at 125%, Ch. 10 conduit fill) that has circuits whose sizes now change on open.
 */
export function needsPec2017Notice(file_export: FileExport): boolean {
	const root = file_export.nodes.find((node) => node.node_type === 'root');
	return !root?.highest_unit_form?.pec_2017_sizing && file_export.nodes.length > 1;
}

/** Once only: renames old conduit overrides and marks the file as sized by PEC 2017. */
function migratePec2017Sizing(nodes: Node[]): Node[] {
	const root = nodes.find((node) => node.node_type === 'root');
	if (!root || root.highest_unit_form?.pec_2017_sizing) return nodes;
	return nodes.map((node) => {
		if (node.node_type === 'root') {
			return { ...node, highest_unit_form: { ...node.highest_unit_form, pec_2017_sizing: true } };
		}
		const conduit_size =
			node.overrided_conduit_size && LEGACY_CONDUIT_SIZES[node.overrided_conduit_size];
		return conduit_size ? { ...node, overrided_conduit_size: conduit_size } : node;
	});
}

export function migrateFileExport(file_export: FileExport): FileExport {
	return {
		...file_export,
		nodes: migratePec2017Sizing(migrateWyeDefaults(file_export.nodes.map(migrateNode)))
	};
}
