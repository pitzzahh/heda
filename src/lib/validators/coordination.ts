import * as v from 'valibot';

/** What the engineer based a device's selective coordination on (PEC 2017 7.0.6.3: documented). */
export const COORDINATION_REFERENCE_SCHEMA = v.object({
	reference: v.optional(
		v.pipe(v.string(), v.trim(), v.maxLength(200, 'Use at most 200 characters.')),
		''
	)
});
