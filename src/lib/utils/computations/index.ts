import {
	standard_ampere_ratings,
	load_type_z_value,
	AMPACITY_RANGES,
	AMPACITY_TO_CONDUCTOR_SIZE
} from '@/constants';
import type { LoadType } from '@/types/load';

// load types with the same formula or value
const commonLoadTypes = [
	'Lighting Load',
	'Convenience Outlet',
	'General Lighting',
	'Heating Equipment'
] as const;

type CommonLoadTypes = (typeof commonLoadTypes)[number];

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
		if (commonLoadTypes.includes(load_type as CommonLoadTypes)) {
			return quantity * varies;
		}

		// load types with separate formula
		return quantity * 230 * varies;
	}

	console.log('Invalid load_type or varies is not a number');
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
	// ambient_temp = 30, //pansamantala
	qty,
	load_type,
	at,
	current
}: {
	set: number;
	qty: number;
	ambient_temp?: number;
	load_type: LoadType | 'Main';
	at: number;
	current: number;
}) {
	const load_type_parameter = getLoadTypeParams(load_type as CommonLoadTypes);
	const total_num_of_conductors = set * qty;

	// digdi ang usage kang ambient temp, but 30 muna and 1 pansamantagal
	const correction_factor = 1; // TODO: create an array of temp rating
	const adjustment_factor = getAdjustmentFactor(total_num_of_conductors);

	const load_type_output =
		load_type === 'Main' ? 1.25 : load_type_parameter === 'at' ? at : 1.25 * current;
	const adjusted_current = load_type_output / (correction_factor * adjustment_factor * set);

	const range = AMPACITY_RANGES.find(
		(range) => adjusted_current > range.min && adjusted_current < range.max
	);
	const final_ampacity = range ? range.value : AMPACITY_RANGES[0].value;

	return AMPACITY_TO_CONDUCTOR_SIZE[final_ampacity];
}

function getLoadTypeParams(load_type: LoadType): 'at' | 'multiply-current' {
	if (commonLoadTypes.includes(load_type as CommonLoadTypes)) {
		return 'at';
	}

	return 'multiply-current';
}

function getAdjustmentFactor(numberOfConductors: number): number {
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
}
