import * as v from 'valibot';
import {
	DEFAULT_PHASES,
	DEFAULT_TERMINAL_TEMPERATURES,
	STANDARD_TERMINAL_TEMPERATURE
} from '#lib/constants/index.js';

// TODO: May issue, need to fix, unused function
export function createEnumPicklist<T extends Record<string, string>>(enumObj: T) {
	return v.picklist(Object.values(enumObj));
}

export const PHASE_FIELD = v.picklist(
	DEFAULT_PHASES.map((option) => option.value),
	'You need to select a phase'
);

export const TERMINAL_TEMPERATURE_FIELD = v.optional(
	v.picklist(
		DEFAULT_TERMINAL_TEMPERATURES.map((option) => option.value),
		'Please select a valid terminal temperature.'
	),
	STANDARD_TERMINAL_TEMPERATURE
);

export const CIRCUIT_NUMBER_FIELD = v.pipe(
	v.number('Please enter a valid circuit number.'),
	v.check((value) => value > 0, 'Circuit number must be greater than 0.')
);

export const AMBIENT_TEMPERATURE_FIELD = v.optional(
	v.number('Please enter a valid ambient temperature.'),
	30
);

export const LENGTH_FIELD = v.number('Please enter a valid length.');

export const QUANTITY_FIELD = v.pipe(
	v.number('Please enter a valid quantity.'),
	v.check((value) => value > 0, 'Quantity must be greater than 0.')
);

export const LOAD_DESCRIPTION_FIELD = v.pipe(
	v.string('Required'),
	v.check((val) => !!val, 'A load description is required.')
);

export const CONTINUOUS_FIELD = v.boolean('Required');

export const PASSWORD_FIELD = v.pipe(
	v.string('A file password is required.'),
	v.minLength(8, 'Password must be at least 8 characters.')
);
