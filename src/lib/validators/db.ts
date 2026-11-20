import * as v from 'valibot';
import {
	TRANSFORMER_KVA_FIELD,
	TRANSFORMER_Z_PERCENT_FIELD,
	UTILITY_SC_KVA_FIELD
} from './short-circuit.js';
import { PHASE_ASSIGNMENT_FIELD } from './shared.js';
import { TITLE_BLOCK_SCHEMA } from './title-block.js';

// Canonical data shapes for the stored project and node documents. Types derive from these schemas
// (see lib/types/db). Defaults are filled in by the engine (crates/heda-core/src/defaults.rs)
// on every open and every edit; the store itself is schemaless.
export const PROJECT_DOC_SCHEMA = v.object({
	id: v.string(),
	project_name: v.optional(v.string()),
	// Older files carry is_adjustment_factor_dynamic here; PEC 2017 3.10.2.6(B)(3)(a) is
	// not optional, so the engine always applies it and the key is dropped.
	settings: v.object({}),
	root_node_id: v.string(),
	/** The sheet set's title block, remembered per project (PEC 2017 1.3.2.2). */
	title_block: v.optional(TITLE_BLOCK_SCHEMA)
});

export const NODE_DOC_SCHEMA = v.object({
	id: v.string(),
	node_type: v.string(),
	circuit_number: v.optional(v.number()),
	overrided_at: v.optional(v.number()),
	overrided_egc_size: v.optional(v.number()),
	overrided_conduit_size: v.optional(v.number()),
	overrided_conductor_size: v.optional(v.number()),
	conductor_sets: v.optional(v.number()),
	conductor_qty: v.optional(v.number()),
	overrided_ampere_frames: v.optional(v.number()),
	conductor_insulation: v.optional(v.string()),
	egc_insulation: v.optional(v.string()),
	conduit_type: v.optional(v.string()),
	pole: v.optional(v.string()),
	/** Override of the circuit-number phase (3P-Y) or line pair (delta); absent means the default rotation. */
	phase_assignment: v.optional(PHASE_ASSIGNMENT_FIELD),
	kaic: v.optional(v.string()),
	length: v.optional(v.number()),
	overrided_length: v.optional(v.number()),
	overrided_z: v.optional(v.number()),
	is_at_used_as_currents_value: v.optional(v.boolean()),
	panel_data: v.optional(
		v.object({
			name: v.string(),
			terminal_temperature: v.string(),
			ambient_temperature: v.number(),
			phase: v.string()
		})
	),
	load_data: v.optional(
		v.object({
			load_description: v.string(),
			terminal_temperature: v.string(),
			ambient_temperature: v.number(),
			quantity: v.number(),
			varies: v.string(),
			continuous: v.boolean(),
			load_type: v.string(),
			config_preference: v.string(),
			/** The PEC 2017 2.10.1.11(C) dwelling circuit this is (20 A), if any. */
			dwelling_circuit: v.optional(v.string()),
			/** A motor's nameplate current and marking, for its overload relay (PEC 2017 4.30.3.2(A)(1)). */
			nameplate_current: v.optional(v.number()),
			nameplate_marked: v.optional(v.boolean())
		})
	),
	highest_unit_form: v.optional(
		v.object({
			distribution_unit: v.optional(v.string()),
			phase: v.optional(v.string()),
			utility_sc_kva: v.optional(UTILITY_SC_KVA_FIELD),
			transformer_kva: v.optional(TRANSFORMER_KVA_FIELD),
			transformer_z_percent: v.optional(TRANSFORMER_Z_PERCENT_FIELD),
			/** false when the supply is a feeder, not the utility service; absent means service (PEC 2017 2.30.6.10). */
			is_service: v.optional(v.boolean()),
			/** Set once a 3P-Y file's circuits carry 400Y/230 V defaults, so they are never rewritten again. */
			wye_circuit_defaults: v.optional(v.boolean()),
			/** Set once a file is opened under the PEC 2017 sizing tables, so its notice and migration run once. */
			pec_2017_sizing: v.optional(v.boolean()),
			/** The PEC 2017 sizing revision the file was last migrated to (see `migrations.ts`). */
			pec_2017_revision: v.optional(v.number())
		})
	),
	parent_id: v.optional(v.string()),
	child_ids: v.array(v.string())
});
