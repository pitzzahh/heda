import type { DEFAULT_LOAD_TYPES_OPTIONS } from '@/constants';
import { standard_ampere_ratings, load_type_z_value } from '@/constants';

type LoadType = (typeof DEFAULT_LOAD_TYPES_OPTIONS)[number];
export function computeVoltAmphere({
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

export function computeAT(current: number, load_type: LoadType) {
	const calculatedAT = current * load_type_z_value[load_type];

	for (const rating of standard_ampere_ratings) {
		if (calculatedAT <= rating) return rating;
	}

	// return the last rating if the calculated AT exceeded the standard ratings
	return standard_ampere_ratings.at(-1);
}
