import * as v from 'valibot';
import { DEFAULT_LOAD_TYPES, default_load_types, FIELD_VALIDATION } from '#lib/constants.js';
import type { ObjectPathItem } from 'valibot';
import {
	AMBIENT_TEMPERATURE_FIELD,
	CIRCUIT_NUMBER_FIELD,
	CONTINUOUS_FIELD,
	LENGTH_FIELD,
	LOAD_DESCRIPTION_FIELD,
	QUANTITY_FIELD,
	TERMINAL_TEMPERATURE_FIELD
} from './shared.js';

export const VARIES_LABEL_FIELD = v.picklist([
	'Unit Wattage',
	'Unit Load',
	'Horsepower Rating',
	'Current Rating'
]);

export const QUANTITY_LABEL_FIELD = v.picklist(['Floor area']);

export const LOAD_TYPE_FIELD = v.picklist(
	DEFAULT_LOAD_TYPES.map((option) => option.value),
	'Please select a valid load type.'
);

/** A preset in the load description picker. */
export const DEFAULT_LOAD_SCHEMA = v.object({
	description: v.string(),
	varies: v.string(),
	continuous: v.boolean(),
	type: LOAD_TYPE_FIELD
});

export const GENERIC_PHASE_MAIN_LOAD_SCHEMA = v.pipe(
	v.object({
		circuit_number: CIRCUIT_NUMBER_FIELD,
		terminal_temperature: TERMINAL_TEMPERATURE_FIELD,
		ambient_temperature: AMBIENT_TEMPERATURE_FIELD,
		length: LENGTH_FIELD,
		quantity: QUANTITY_FIELD,
		load_description: LOAD_DESCRIPTION_FIELD,
		varies: v.string('This field is required'),
		continuous: CONTINUOUS_FIELD,
		load_type: LOAD_TYPE_FIELD
	}),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const data = dataset.value;
		// Horsepower is picked from a table and replaced by its full-load current on submit.
		if (
			!data ||
			data.load_type === default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER ||
			data.load_type === default_load_types.THREE_P_MOTOR__RATED_HORSE_POWER
		)
			return;
		const path = (key: 'varies'): [ObjectPathItem] => [
			{ type: 'object', origin: 'value', input: data, key, value: data[key] }
		];
		if (!data.varies) {
			addIssue({ message: 'This field is required.', path: path('varies') });
		}
		if (!FIELD_VALIDATION.TEST.ALL_NUMBER(data.varies)) {
			addIssue({ message: 'This field must be a number.', path: path('varies') });
		}
	})
);
