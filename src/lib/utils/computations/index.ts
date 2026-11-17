import {
	standard_ampere_ratings,
	load_type_z_value,
	default_load_types,
	AMPACITY_RANGES,
	AMPACITY_TO_CONDUCTOR_SIZE,
	AMBIENT_TEMP_RATINGS,
	AMPERE_TRIP_TO_COPPER,
	CONDUIT_FILL_AREAS,
	THHN_CONDUCTOR_AREAS,
	MOTOR_LOAD_TYPES,
	SQRT_3,
	THREE_PHASE_MOTOR_FLC_400V,
	WYE_LINE_VOLTAGE,
	default_hp_current_relationship
} from '#lib/constants.js';
import type { LoadType } from '#lib/types/load.js';

// load types with the same formula or value
const common_load_types = [
	default_load_types.LIGHTING_LOAD,
	default_load_types.CONVENIENCE_OUTLET,
	default_load_types.GENERAL_LIGHTING,
	default_load_types.HEATING_EQUIPMENT,
	default_load_types.THREE_P_EQUIPMENT
] as const;

const three_phase_motor_types: readonly string[] = [
	default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER,
	default_load_types.THREE_P_MOTOR__RATED_CURRENT
];

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

type CommonLoadTypes = (typeof common_load_types)[number];

export function computeVoltAmpere({
	load_type,
	quantity,
	varies
}: {
	load_type: LoadType;
	quantity: number;
	varies: number | string;
}) {
	const is_varies_number = typeof varies === 'number';

	if (is_varies_number) {
		if (common_load_types.includes(load_type as CommonLoadTypes)) {
			return quantity * varies;
		}

		// Three-phase motors: VA = 1.732 × 400 V × full-load current (PEC 2017 App. D Ex. D6 6.3).
		if (three_phase_motor_types.includes(load_type)) {
			return quantity * SQRT_3 * WYE_LINE_VOLTAGE * varies;
		}

		// load types with separate formula
		return quantity * 230 * varies;
	}
	console.warn(`Invalid load_type or varies is not a number: ${varies}`);
}

export function computeAmpereTrip(current: number, load_type?: LoadType) {
	const PANEL_Z_VALUE = 1.25;
	const calculated_at = current * (load_type ? load_type_z_value[load_type] : PANEL_Z_VALUE);

	if (!load_type && calculated_at < 30) return 30; //for panels

	// for all load types except lighting and general
	if (
		load_type !== default_load_types.LIGHTING_LOAD &&
		load_type !== default_load_types.GENERAL_LIGHTING &&
		calculated_at < 20
	)
		return 20;

	for (const rating of standard_ampere_ratings) {
		if (calculated_at <= rating) return rating;
	}

	return 0;
}

export function computeConductorSize({
	set,
	ambient_temp,
	qty,
	load_type,
	at,
	current,
	is_adjustment_factor_dynamic
}: {
	set: number;
	qty: number;
	ambient_temp: number;
	load_type: LoadType | 'Main';
	at: number;
	current: number;
	is_adjustment_factor_dynamic: boolean;
}) {
	const is_motor_load = MOTOR_LOAD_TYPES.includes(load_type);
	const adjusted_current = computeAdjustedCurrent({
		set,
		ambient_temp,
		qty,
		load_type,
		at,
		current,
		is_adjustment_factor_dynamic
	});

	// NOTE: THIS AMPACITY RANGES MAY VARY DEPENDING ON THE TERMINAL TEMPERATURE
	const range = AMPACITY_RANGES.find(
		(range) => adjusted_current > range.min && adjusted_current <= range.max
	);

	const final_ampacity = range ? range.value : AMPACITY_RANGES[0].value;
	const conductor_size = AMPACITY_TO_CONDUCTOR_SIZE[final_ampacity];

	return is_motor_load && conductor_size <= 2 ? 3.5 : conductor_size;
}

export function computeAdjustedCurrent({
	set,
	ambient_temp,
	qty,
	load_type,
	at,
	current,
	is_adjustment_factor_dynamic
}: {
	set: number;
	qty: number;
	ambient_temp: number;
	load_type: LoadType | 'Main';
	at: number;
	current: number;
	is_adjustment_factor_dynamic: boolean;
}) {
	const load_type_parameter = getLoadTypeParams(load_type);
	const total_num_of_conductors = set * qty;

	const correction_factor =
		AMBIENT_TEMP_RATINGS.find((temp_rating) => ambient_temp <= temp_rating.max_temp)?.factor ?? 1; // digdi ang usage kang ambient temp
	const adjustment_factor = getAdjustmentFactor(
		total_num_of_conductors,
		is_adjustment_factor_dynamic
	);

	const load_type_output = load_type_parameter === 'at' ? at : 1.25 * current;
	const adjusted_current = load_type_output / (correction_factor * adjustment_factor * set);

	return adjusted_current;
}

function getLoadTypeParams(load_type: LoadType | 'Main'): 'at' | 'multiply-current' {
	const commond_load_types_with_main = [...common_load_types, 'Main']; //the Main here is if the node is a panel
	if (commond_load_types_with_main.includes(load_type as CommonLoadTypes)) {
		return 'at';
	}
	return 'multiply-current';
}

function getAdjustmentFactor(
	numberOfConductors: number,
	is_adjustment_factor_dynamic: boolean
): number {
	if (is_adjustment_factor_dynamic) {
		if (numberOfConductors <= 3) {
			return 1.0;
		}

		if (numberOfConductors <= 6) {
			return 0.8;
		} else if (numberOfConductors <= 9) {
			return 0.7;
		} else if (numberOfConductors <= 20) {
			return 0.5;
		} else if (numberOfConductors <= 30) {
			return 0.45;
		} else if (numberOfConductors <= 40) {
			return 0.4;
		} else {
			return 0.35;
		}
	} else return 1.0;
}

export function getEgcSize(at: number) {
	if (at <= 0) return -1;
	const range = AMPERE_TRIP_TO_COPPER.find((r) => at > r.at_threshold);
	return range?.size ?? -1;
}

/**
 * Smallest conduit whose PEC 2017 Table 10.1.1.1 fill area holds `total_num_of_conductors`
 * THHN conductors of `conductor_size`; -1 when none of Table 10.1.1.4's sizes does.
 */
export function getConduitSize(conductor_size: number, total_num_of_conductors: number) {
	if (conductor_size > 530) {
		return 'Error';
	}

	const conductor_area = THHN_CONDUCTOR_AREAS[conductor_size];

	if (!conductor_area) {
		return 'Invalid conductor size';
	}

	const fill_key =
		total_num_of_conductors === 1 ? 'one' : total_num_of_conductors === 2 ? 'two' : 'over_two';
	const row = CONDUIT_FILL_AREAS.find(
		(row) => maxConductorsInArea(row[fill_key], conductor_area) >= total_num_of_conductors
	);

	return row?.size ?? -1;
}

/** PEC 2017 Ch. 10 Note 7: a fractional count of 0.8 or more rounds up to the next whole conductor. */
export function maxConductorsInArea(fill_area: number, conductor_area: number) {
	// + 0.2 lifts x.8 and above to the next whole number; 1e-9 absorbs float error (48 / 10 → 4.7999…).
	return Math.floor(fill_area / conductor_area + 0.2 + 1e-9);
}

export * from './short-circuit.js';
export * from './three-phase.js';
