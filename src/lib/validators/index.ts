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
		use_password: v.optional(v.boolean(), false),
		// Optional: no password means the file uses this device's key and opens
		// without a prompt. A password is only for files that must be shared.
		password: v.optional(PASSWORD_FIELD),
		confirm_password: v.optional(v.string('Please confirm the file password.'))
	}),
	v.forward(
		v.partialCheck(
			[['password'], ['confirm_password']],
			(input) => input.password === input.confirm_password,
			'Passwords do not match.'
		),
		['confirm_password']
	),
	v.forward(
		v.partialCheck(
			[['use_password'], ['password']],
			(input) => !input.use_password || !!input.password,
			'Set a file password or turn off password protection.'
		),
		['password']
	)
);
