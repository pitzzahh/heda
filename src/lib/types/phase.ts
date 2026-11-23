import type * as v from 'valibot';
import type {
	CIRCUIT_PHASE_FIELD,
	LINE_CURRENT_SCHEMA,
	PHASE_ASSIGNMENT_FIELD,
	PHASE_FIELD
} from '#lib/validators/shared.js';

export type Phase = v.InferOutput<typeof PHASE_FIELD>;

export type PhaseAssignment = v.InferOutput<typeof PHASE_ASSIGNMENT_FIELD>;

export type CircuitPhase = v.InferOutput<typeof CIRCUIT_PHASE_FIELD>;

export type LineCurrent = v.InferOutput<typeof LINE_CURRENT_SCHEMA>;
