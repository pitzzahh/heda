import type * as v from 'valibot';
import type { STANDBY_GENERATOR_SCHEMA } from '#lib/validators/generator.js';

export type StandbyGenerator = v.InferOutput<typeof STANDBY_GENERATOR_SCHEMA>;
