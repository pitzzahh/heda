import * as v from 'valibot';
import {
	CIRCUIT_PHASE_FIELD,
	LINE_CURRENT_SCHEMA,
	PAIR_VA_SCHEMA,
	PHASE_VA_SCHEMA
} from './shared.js';

// Computed load-schedule values. The node's stored fields merge in at the type
// level (lib/types), so these schemas hold only what the computation adds.

/** Fields every computed circuit carries, whatever path computed it. */
const COMPUTED_CIRCUIT_ENTRIES = {
	load_description: v.string(),
	voltage: v.number(),
	va: v.number(),
	current: v.number(),
	at: v.number(),
	/** -1 when no conductor of PEC 2017 Table 3.10.2.6(B)(16) meets the circuit. */
	conductor_size: v.number(),
	ampere_frames: v.number(),
	/** What the circuit draws from: A/B/C on 3P-Y, AB/BC/CA on delta (single-phase), or ABC. */
	phase: v.optional(CIRCUIT_PHASE_FIELD),
	/** 3P-Y panels: VA on each phase. */
	phase_va: v.optional(PHASE_VA_SCHEMA),
	/** Delta panels: VA on each line pair. */
	pair_va: v.optional(PAIR_VA_SCHEMA),
	/** Delta panels: current in each line, from the pair currents 120° apart. */
	line_current: v.optional(LINE_CURRENT_SCHEMA),
	/** Three-phase panels: balanced current, VA ÷ (line voltage × 1.732) (PEC 2017 App. D Ex. D6); `current` is the design value. */
	balanced_current: v.optional(v.number()),
	/** Three-phase panels: largest deviation of the phase (or line pair) VA from their average, in % (NEMA MG-1 14.35; PEC 2017 sets none). */
	unbalance: v.optional(v.number()),
	/** Allowable ampacity of the conductors, all sets: the lower of the termination limit (PEC 2017 1.10.1.14(C)) and the corrected ampacity (3.10.2.6(B)); absent where the code gives none. */
	ampacity: v.optional(v.number()),
	/** A motor's largest overload relay rating, from its nameplate current (PEC 2017 4.30.3.2(A)(1)); absent without one. */
	overload: v.optional(v.number()),
	/** On a three-phase supply: the VA it puts on each phase (or line pair) in label order, null where none (PEC 2017 2.20.3.22). */
	phase_loads: v.optional(
		v.tuple([v.nullable(v.number()), v.nullable(v.number()), v.nullable(v.number())])
	)
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
