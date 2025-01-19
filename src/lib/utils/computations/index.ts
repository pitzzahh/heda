import {
	standard_ampere_ratings,
	load_type_z_value,
	AMPACITY_RANGES,
	AMPACITY_TO_CONDUCTOR_SIZE,
	AMBIENT_TEMP_RATINGS,
	AMPERE_TRIP_TO_COPPER,
	CONDUIT_TABLE
} from '@/constants';
import type { LoadType } from '@/types/load';

// load types with the same formula or value
const common_load_types = [
	'Lighting Load',
	'Convenience Outlet',
	'General Lighting',
	'Heating Equipment'
] as const;

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
	if (load_type !== 'Lighting Load' && load_type !== 'General Lighting' && calculated_at < 20)
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
	const motor_loads = ['1P Motor - Rated Horse Power', '1P Motor - Rated Current'];
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

	return load_type && motor_loads.includes(load_type) && conductor_size <= 2 ? 3.5 : conductor_size;
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

export function getConduitSize(conductor_size: number, total_num_of_conductors: number) {
	if (conductor_size > 530) {
		return 'Error';
	}

	const row = CONDUIT_TABLE.conductor_rows.find((row) => row.conductor_size === conductor_size);

	if (!row) {
		return 'Invalid conductor size';
	}

	let nearest_value = Infinity;
	let column_index = -1;

	for (let i = 0; i < row.values.length; i++) {
		const value = row.values[i];
		if (value >= total_num_of_conductors && value < nearest_value) {
			nearest_value = value;
			column_index = i;
		}
	}

	return column_index === -1 ? column_index : CONDUIT_TABLE.conduit_columns[column_index];
}
