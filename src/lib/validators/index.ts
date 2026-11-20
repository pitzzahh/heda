import * as v from 'valibot';
import { PASSWORD_FIELD, PHASE_FIELD } from './shared.js';

export * from './load.js';
export * from './panel.js';
export * from './db.js';
export * from './misc.js';
export * from './settings.js';
export * from './short-circuit.js';
export * from './generator.js';
export * from './schedule.js';
export * from './voltage-drop.js';
export * from './file.js';
export * from './title-block.js';
export * from './coordination.js';

export const HIGHEST_UNIT_SCHEMA = v.pipe(
	v.object({
		// A blank name falls back to the form's placeholder, "Transformer".
		distribution_unit: v.optional(
			v.pipe(
				v.string(),
				v.transform((val) => val.trim() || 'Transformer')
			),
			'Transformer'
		),
		phase: PHASE_FIELD,
		// The utility service supplies the project, so its first panel holds the service
		// disconnecting means and its PEC 2017 2.30.6.10 minimum rating.
		is_service: v.optional(v.boolean(), true),
		// Android only: desktop names the file in the save dialog. Blank means
		// "Untitled project"; unsafe characters are replaced when the file is made.
		project_name: v.optional(
			v.pipe(v.string(), v.trim(), v.maxLength(100, 'Use at most 100 characters.'))
		),
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
