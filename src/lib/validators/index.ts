import * as v from 'valibot';
import { PASSWORD_FIELD, PHASE_FIELD } from './shared.js';

export * from './load/index.js';
export * from './panel/index.js';
export * from './db.js';
export * from './misc.js';
export * from './settings.js';

export const HIGHEST_UNIT_SCHEMA = v.pipe(
	v.object({
		distribution_unit: v.optional(
			v.pipe(
				v.string(),
				v.check((val) => !!val, 'A distribution unit is required.')
			),
			'Transformer'
		),
		phase: PHASE_FIELD,
		password: PASSWORD_FIELD,
		confirm_password: v.string('Please confirm the file password.')
	}),
	v.forward(
		v.partialCheck(
			[['password'], ['confirm_password']],
			(input) => input.password === input.confirm_password,
			'Passwords do not match.'
		),
		['confirm_password']
	)
);
