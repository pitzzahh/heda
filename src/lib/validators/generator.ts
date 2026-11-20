import * as v from 'valibot';

/** The optional standby generator's nameplate rating (PEC 2017 Article 7.2). */
export const GENERATOR_KVA_FIELD = v.pipe(
	v.number('Please enter the generator rating.'),
	v.check((value) => value > 0, 'Generator rating must be greater than 0.')
);

export const STANDBY_GENERATOR_SCHEMA = v.object({
	generator_kva: v.optional(GENERATOR_KVA_FIELD)
});
