import {
	DEFAULT_LOADS,
	DEFAULT_LOAD_TYPES,
	DEFAULT_PHASES,
	DEFAULT_TERMINAL_TEMPERATURES,
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases,
	PEC_2017_REVISION
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
 * The PEC 2017 sizing revision a file was migrated to. 1: the sizing tables (breaker
 * ratings, Ch. 10 conduit fill, heating at 125 %), once marked only by `pec_2017_sizing`.
 * 2: conductors by 3.10.2.6(B) and 1.10.1.14(C), continuous loads, dwelling circuits and
 * motor feeders.
 */
function revisionOf(root: Node | undefined): number {
	const form = root?.highest_unit_form;
	return form?.pec_2017_revision ?? (form?.pec_2017_sizing ? 1 : 0);
}

/** A file from before the current PEC 2017 revision, with circuits whose sizes change on open. */
export function needsPec2017Notice(file_export: FileExport): boolean {
	const root = file_export.nodes.find((node) => node.node_type === 'root');
	return revisionOf(root) < PEC_2017_REVISION && file_export.nodes.length > 1;
}

const DWELLING_PRESETS = new Map(
	DEFAULT_LOADS.filter((preset) => preset.dwelling_circuit).map((preset) => [
		preset.description,
		preset
	])
);

/**
 * Revision 2: a load named after a dwelling-circuit preset gets its PEC 2017 2.10.1.11(C)
 * marker, which keeps it at 20 A. A default load also takes the preset's VA: bathroom and
 * garage circuits drop the 1500 VA heda used to give them for the 0 VA of 2.20.2.5(J).
 * Default loads cannot edit their VA, so that value was heda's; a custom load's is the user's.
 */
function migrateDwellingCircuit(node: Node): Node {
	const load_data = node.load_data;
	if (!load_data || load_data.dwelling_circuit) return node;
	const preset = DWELLING_PRESETS.get(load_data.load_description.split(' - ')[1]);
	if (!preset) return node;
	return {
		...node,
		load_data: {
			...load_data,
			dwelling_circuit: preset.dwelling_circuit,
			...(load_data.config_preference === 'DEFAULT' && { varies: preset.varies })
		}
	};
}

/** Once per revision: brings the file's nodes up to `PEC_2017_REVISION` and records it. */
function migratePec2017Sizing(nodes: Node[]): Node[] {
	const root = nodes.find((node) => node.node_type === 'root');
	const revision = revisionOf(root);
	if (!root || revision >= PEC_2017_REVISION) return nodes;
	return nodes.map((node) => {
		if (node.node_type === 'root') {
			return {
				...node,
				highest_unit_form: {
					...node.highest_unit_form,
					pec_2017_sizing: true,
					pec_2017_revision: PEC_2017_REVISION
				}
			};
		}
		const conduit_size =
			revision < 1 && node.overrided_conduit_size
				? LEGACY_CONDUIT_SIZES[node.overrided_conduit_size]
				: undefined;
		const migrated = conduit_size ? { ...node, overrided_conduit_size: conduit_size } : node;
		return revision < 2 ? migrateDwellingCircuit(migrated) : migrated;
	});
}

export function migrateFileExport(file_export: FileExport): FileExport {
	return {
		...file_export,
		nodes: migratePec2017Sizing(migrateWyeDefaults(file_export.nodes.map(migrateNode)))
	};
}
