import * as v from 'valibot';
import { DEFAULT_LOAD_TYPES, default_load_types, FIELD_VALIDATION } from '#lib/constants/index.js';
import type { ObjectPathItem } from 'valibot';
import {
	AMBIENT_TEMPERATURE_FIELD,
	CIRCUIT_NUMBER_FIELD,
	CONTINUOUS_FIELD,
	LENGTH_FIELD,
	LOAD_DESCRIPTION_FIELD,
	QUANTITY_FIELD,
	TERMINAL_TEMPERATURE_FIELD
} from '../shared.js';

export const VARIES_LABEL_FIELD = v.picklist([
	'Unit Wattage',
	'Unit Load',
	'Horsepower Rating',
	'Current Rating'
]);

export const QUANTITY_LABEL_FIELD = v.picklist(['Floor area']);

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
		load_type: v.picklist(
			DEFAULT_LOAD_TYPES.map((option) => option.value),
			'Please select a valid load type.'
		)
	}),
	v.rawCheck(({ dataset, addIssue }) => {
		if (!dataset.typed) return;
		const data = dataset.value;
		if (!data || data.load_type === default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER) return;
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
