import type { DEFAULT_LOAD_TYPES_OPTIONS } from '@/constants';
import { standard_ampere_ratings, load_type_z_value } from '@/constants';

type LoadType = (typeof DEFAULT_LOAD_TYPES_OPTIONS)[number];
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

	// load types with the same formula
	const commonLoadTypes = [
		'Lighting Load',
		'Convenience Outlet',
		'General Lighting',
		'Heating Equipment'
	] as const;

	if (is_varies_number) {
		if (commonLoadTypes.includes(load_type as (typeof commonLoadTypes)[number])) {
			return quantity * varies;
		}

		// load types with separate formula
		return quantity * 230 * varies;

		// switch (load_type) {
		// 	case '1P Motor - Rated Current':
		// 		return quantity * 230 * varies;
		// 	// case '1P Motor - Rated Horse Power':
		// 	// 	return quantity * 230 * output of the varies;
		// }
	}

	console.log('Invalid load_type or varies is not a number');
}

export function computeAmpereTrip(current: number, load_type?: LoadType) {
	const PANEL_Z_VALUE = 1.25;
	const calculatedAT = current * (load_type ? load_type_z_value[load_type] : PANEL_Z_VALUE);

	if (!load_type && calculatedAT < 30) return 30; //for panels

	// for all load types except lighting and general
	if (load_type !== 'Lighting Load' && load_type !== 'General Lighting' && calculatedAT < 20)
		return 20;

	for (const rating of standard_ampere_ratings) {
		if (calculatedAT <= rating) return rating;
	}

	return 0;
}