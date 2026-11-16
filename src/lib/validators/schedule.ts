import * as v from 'valibot';
import { LOAD_TYPE_FIELD } from './load.js';
import { CIRCUIT_PHASE_FIELD, PHASE_VA_SCHEMA } from './shared.js';

// Computed load-schedule values. The node's stored fields merge in at the type
// level (lib/types), so these schemas hold only what the computation adds.

/** Fields every computed circuit carries, whatever path computed it. */
const COMPUTED_CIRCUIT_ENTRIES = {
	load_description: v.string(),
	voltage: v.number(),
	va: v.number(),
	current: v.number(),
	at: v.number(),
	conductor_size: v.number(),
	adjusted_current: v.number(),
	ampere_frames: v.number(),
	/** Phases the circuit draws from on a 3P-Y supply: A/B/C (single-phase) or ABC. */
	phase: v.optional(CIRCUIT_PHASE_FIELD),
	/** 3P-Y panels: VA on each phase. */
	phase_va: v.optional(PHASE_VA_SCHEMA),
	/** 3P-Y panels: PEC 2017 App. D Ex. D6 balanced current, VA ÷ (400 × 1.732); `current` is the design value. */
	balanced_current: v.optional(v.number())
};

/** One row of the load schedule table (computeNodeLoad). */
export const LOAD_SCHEDULE_ROW_SCHEMA = v.object({
	...COMPUTED_CIRCUIT_ENTRIES,
	circuit_number: v.number(),
	egc_size: v.number(),
	conduit_size: v.number()
});

/** A node resolved for the sidebar and page header (getNodeById). */
export const NODE_BY_ID_RESULT_SCHEMA = v.object({
	...COMPUTED_CIRCUIT_ENTRIES,
	conduit_size: v.union([v.string(), v.number()]),
	egc_size: v.union([v.number(), v.literal('error')])
});

/** Inputs shared by the AT, conductor, conduit and EGC sizing of one circuit. */
export const COMPUTE_COMMON_PROPERTIES_SCHEMA = v.object({
	va: v.number(),
	current: v.number(),
	conductor_set: v.number(),
	conductor_qty: v.number(),
	load_type: v.union([LOAD_TYPE_FIELD, v.literal('Main')]),
	ambient_temp: v.number(),
	overrided_at: v.optional(v.number()),
	overrided_conductor_size: v.optional(v.number()),
	overrided_egc_size: v.optional(v.number()),
	overrided_conduit_size: v.optional(v.number())
});
