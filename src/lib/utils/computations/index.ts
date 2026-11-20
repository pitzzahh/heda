import { default_load_types, default_phases } from '#lib/constants.js';
import { getCatalog } from '#lib/core/catalog.js';
import type { MotorTable } from '#lib/types/catalog.js';

/**
 * Horsepower → full-load current table of a motor type under a supply: PEC 2017
 * Table 4.30.14.2 (230 V) for single-phase motors, Table 4.30.14.4 at the line
 * voltage for three-phase ones (230 V on delta, else 400 V). Other types have none.
 */
export function horsepowerTable(
	load_type: string | undefined,
	supply_phase: string | undefined
): MotorTable | undefined {
	const { motor_flc } = getCatalog();
	if (load_type === default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER)
		return motor_flc.one_phase_230;
	if (load_type !== default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER) return undefined;
	return supply_phase === default_phases.THREE_PHASE_DELTA
		? motor_flc.three_phase_230
		: motor_flc.three_phase_400;
}

/**
 * The full-load current a motor picked by horsepower is stored as, as the text the
 * form stores (`'8'`, `'2.2'`). Undefined for a horsepower the table has no row for.
 */
export function currentOfHorsepower(
	load_type: string | undefined,
	horsepower: string | undefined,
	supply_phase?: string
): string | undefined {
	const row = horsepowerTable(load_type, supply_phase)?.find(([hp]) => hp === horsepower);
	return row && String(row[1]);
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
	return table.find(([, amps]) => amps === Number(varies))?.[0];
}

export * from './three-phase.js';
