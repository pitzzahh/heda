import {
	THREE_PHASE_MOTOR_FLC_230V,
	THREE_PHASE_MOTOR_FLC_400V,
	default_hp_current_relationship,
	default_load_types,
	default_phases
} from '#lib/constants.js';

/**
 * Horsepower → full-load current table of a motor type under a supply: PEC 2017
 * Table 4.30.14.2 (230 V) for single-phase motors, Table 4.30.14.4 at the line
 * voltage for three-phase ones (230 V on delta, else 400 V). Other types have none.
 */
export function horsepowerTable(
	load_type: string | undefined,
	supply_phase: string | undefined
): Readonly<Record<string, string>> | undefined {
	if (load_type === default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER) {
		return default_hp_current_relationship;
	}
	if (load_type !== default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER) return undefined;
	return supply_phase === default_phases.THREE_PHASE_DELTA
		? THREE_PHASE_MOTOR_FLC_230V
		: THREE_PHASE_MOTOR_FLC_400V;
}

/**
 * Motors picked by horsepower are stored as their full-load current; this maps
 * the current back to the horsepower so the picker can show it on edit. Other
 * load types pass through.
 */
export function horsepowerOfCurrent(
	load_type: string | undefined,
	varies: string | undefined,
	supply_phase?: string
): string | undefined {
	const table = horsepowerTable(load_type, supply_phase);
	if (!table || varies === undefined) return varies;
	return Object.keys(table).find((hp) => Number(table[hp]) === Number(varies));
}

export * from './three-phase.js';
