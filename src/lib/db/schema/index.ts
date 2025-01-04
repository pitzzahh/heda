import {
	toTypedRxJsonSchema,
	type ExtractDocumentTypeFromTypedRxJsonSchema,
	type RxJsonSchema
} from 'rxdb';

const project_schema_literal = {
	version: 0,
	primaryKey: 'id',
	type: 'object',
	properties: {
		id: { type: 'string', maxLength: 100 },
		project_name: { type: 'string' },
		settings: {
			type: 'object',
			properties: {
				is_adjustment_factor_dynamic: {
					type: 'boolean',
					default: false
				}
			}
		},
		root_node_id: { type: 'string' }
	},
	required: ['id', 'root_node_id', 'settings']
} as const;

const node_literal = {
	version: 0,
	primaryKey: 'id',
	type: 'object',
	properties: {
		id: { type: 'string', maxLength: 100 },
		node_type: { type: 'string' },
		circuit_number: { type: 'number' },
		overrided_at: { type: 'number' },
		overrided_egc_size: { type: 'number' },
		overrided_conduit_size: { type: 'number' },
		overrided_conductor_size: { type: 'number' },
		conductor_sets: { type: 'number', default: 1 },
		conductor_qty: { type: 'number', default: 2 },
		overrided_ampere_frames: { type: 'number' },
		conductor_insulation: { type: 'string', default: 'THHN-Cu' },
		egc_insulation: { type: 'string', default: 'TW-Cu' },
		conduit_type: { type: 'string', default: 'PVC' },
		pole: { type: 'string', default: '2' },
		kaic: { type: 'string', default: '5' },
		length: { type: 'number' },
		is_at_used_as_currents_value: { type: 'boolean', default: false },
		panel_data: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				terminal_temperature: { type: 'string' },
				ambient_temperature: { type: 'number' },
				phase: { type: 'string' }
			},
			additionalProperties: false,
			required: [
				'name',
				'terminal_temperature',
				'terminal_temperature',
				'phase',
				'ambient_temperature'
			]
		},
		load_data: {
			type: 'object',
			properties: {
				load_description: { type: 'string' },
				terminal_temperature: { type: 'string' },
				ambient_temperature: { type: 'number' },
				quantity: { type: 'number' },
				varies: { type: 'string' },
				continuous: { type: 'boolean' },
				load_type: { type: 'string' },
				config_preference: { type: 'string' } // bale ang magiging value kani is CUSTOM or DEFAULT para pag nag update, automatic naka set na sa form
			},
			additionalProperties: false,
			required: [
				'load_description',
				'terminal_temperature',
				'quantity',
				'varies',
				'continuous',
				'load_type',
				'config_preference',
				'ambient_temperature'
			]
		},
		// this object should be present if it is root node
		highest_unit_form: {
			type: 'object',
			properties: {
				distribution_unit: { type: 'string' },
				phase: { type: 'string' }
			},
			additionalProperties: false
		},
		parent_id: { type: 'string' },
		child_ids: {
			type: 'array',
			items: { type: 'string' }
		}
	},
	required: ['id', 'node_type', 'child_ids']
} as const;

const typed_project_schema = toTypedRxJsonSchema(project_schema_literal);
const typed_node_schema = toTypedRxJsonSchema(node_literal);

// aggregate the document type from the schema
export type Project = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_project_schema>;
export type Node = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_node_schema>;

// create the typed RxJsonSchema from the literal typed object.
export const project_schema: RxJsonSchema<Project> = project_schema_literal;
export const node_schema: RxJsonSchema<Node> = node_literal;
