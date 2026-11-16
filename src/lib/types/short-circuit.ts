import type * as v from 'valibot';
import type {
	INTERRUPTING_RATING_STATUS_FIELD,
	SHORT_CIRCUIT_RESULT_SCHEMA,
	SHORT_CIRCUIT_SOURCE_SCHEMA
} from '#lib/validators/short-circuit.js';
import type { PhaseLoadSchedule } from './schedule.js';

export type ShortCircuitSource = v.InferOutput<typeof SHORT_CIRCUIT_SOURCE_SCHEMA>;

export type InterruptingRatingStatus = v.InferOutput<typeof INTERRUPTING_RATING_STATUS_FIELD>;

export type ShortCircuit = v.InferOutput<typeof SHORT_CIRCUIT_RESULT_SCHEMA> & PhaseLoadSchedule;
