import * as v from 'valibot';

// Canonical data shapes for SignalDB documents. Types derive from these schemas
// (see lib/types/db). Insert defaults live in lib/db/mutations (withNodeDefaults
// / withProjectDefaults); the store itself is schemaless.
export const PROJECT_DOC_SCHEMA = v.object({
	id: v.string(),
	project_name: v.optional(v.string()),
	settings: v.object({
		is_adjustment_factor_dynamic: v.optional(v.boolean())
	}),
	root_node_id: v.string()
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
			config_preference: v.string()
		})
	),
	highest_unit_form: v.optional(
		v.object({
			distribution_unit: v.optional(v.string()),
			phase: v.optional(v.string())
		})
	),
	parent_id: v.optional(v.string()),
	child_ids: v.array(v.string())
});
