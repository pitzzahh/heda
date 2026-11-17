import * as v from 'valibot';

// Source data for PEC 2017 App. D Ex. D14 (per-unit method), steps 3, 4 and 6.
export const UTILITY_SC_KVA_FIELD = v.pipe(
	v.number('Please enter the utility short-circuit level.'),
	v.check((value) => value > 0, 'Utility short-circuit level must be greater than 0.')
);

export const TRANSFORMER_KVA_FIELD = v.pipe(
	v.number('Please enter the transformer rating.'),
	v.check((value) => value > 0, 'Transformer rating must be greater than 0.')
);

export const TRANSFORMER_Z_PERCENT_FIELD = v.pipe(
	v.number('Please enter the transformer impedance.'),
	v.check(
		(value) => value > 0 && value <= 100,
		'Transformer impedance must be above 0% and at most 100%.'
	)
);

export const SHORT_CIRCUIT_SOURCE_SCHEMA = v.object({
	utility_sc_kva: UTILITY_SC_KVA_FIELD,
	transformer_kva: TRANSFORMER_KVA_FIELD,
	transformer_z_percent: TRANSFORMER_Z_PERCENT_FIELD
});

/** PEC 2017 1.10.1.9 outcome; `no_source` means the source data is missing. */
export const INTERRUPTING_RATING_STATUS_FIELD = v.picklist(['ok', 'under_rated', 'no_source']);

const NULLABLE_NUMBER = v.nullable(v.number());

/** One computed short-circuit row (PEC 2017 App. D Ex. D14), before the load fields merge in. */
export const SHORT_CIRCUIT_RESULT_SCHEMA = v.object({
	from_node_name: v.string(),
	to_node_name: v.string(),
	length: v.number(),
	/** Conductor run impedance (both conductors for single-phase), ohms. */
	conductor_z_ohm: v.number(),
	conductor_z_pu: v.number(),
	/** Motor impedance on the kVA base (D14 step 8); null when not a motor. */
	motor_z_pu: NULLABLE_NUMBER,
	/** Thevenin impedance at the supply bus (the breaker's line terminals), per unit. */
	supply_z_pu: NULLABLE_NUMBER,
	/** Available symmetrical fault current at the breaker's line terminals, amperes. */
	supply_fault_current: NULLABLE_NUMBER,
	/** Available symmetrical fault current at the end of this node's run, amperes. */
	node_fault_current: NULLABLE_NUMBER,
	interrupting_rating_ka: v.number(),
	status: INTERRUPTING_RATING_STATUS_FIELD
});
