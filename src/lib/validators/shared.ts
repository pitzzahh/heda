import * as v from 'valibot';
import {
	DEFAULT_PHASES,
	DEFAULT_TERMINAL_TEMPERATURES,
	LINE_PAIRS,
	PHASE_ASSIGNMENTS,
	STANDARD_TERMINAL_TEMPERATURE
} from '#lib/constants.js';

export const PHASE_FIELD = v.picklist(
	DEFAULT_PHASES.map((option) => option.value),
	'You need to select a phase'
);

/**
 * Where a single-phase circuit connects on a three-phase panel: a phase of a
 * 400Y/230 V panel (PEC 2017 App. D Ex. D6 6.1) or a line pair of a 230 V delta one.
 */
export const PHASE_ASSIGNMENT_FIELD = v.picklist(
	[...PHASE_ASSIGNMENTS, ...LINE_PAIRS],
	'Please select phase A, B or C, or line pair AB, BC or CA.'
);

/** What a circuit draws from on a three-phase panel: a phase, a line pair, or all three lines. */
export const CIRCUIT_PHASE_FIELD = v.picklist([...PHASE_ASSIGNMENTS, ...LINE_PAIRS, 'ABC']);

/** VA carried by each phase of a 3P-Y panel. */
export const PHASE_VA_SCHEMA = v.object({ A: v.number(), B: v.number(), C: v.number() });

/** VA carried by each line pair of a delta panel. */
export const PAIR_VA_SCHEMA = v.object({ AB: v.number(), BC: v.number(), CA: v.number() });

/** Current in each line of a delta panel. */
export const LINE_CURRENT_SCHEMA = v.object({ A: v.number(), B: v.number(), C: v.number() });

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
