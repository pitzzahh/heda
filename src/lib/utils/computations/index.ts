import {
	THREE_PHASE_MOTOR_FLC_400V,
	default_hp_current_relationship,
	default_load_types
} from '#lib/constants.js';

/**
 * Motors picked by horsepower are stored as their full-load current; this maps
 * the current back to the horsepower so the picker can show it on edit. Other
 * load types pass through.
 */
export function horsepowerOfCurrent(
	load_type: string | undefined,
	varies: string | undefined
): string | undefined {
	const table: Readonly<Record<string, string>> | undefined =
		load_type === default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER
			? default_hp_current_relationship
			: load_type === default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER
				? THREE_PHASE_MOTOR_FLC_400V
				: undefined;
	if (!table || varies === undefined) return varies;
	return Object.keys(table).find((hp) => Number(table[hp]) === Number(varies));
}

export * from './three-phase.js';
