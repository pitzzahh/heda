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
		root_node_id: { type: 'string' }
	},
	required: ['id', 'root_node_id']
} as const;

const node_literal = {
	version: 0,
	primaryKey: 'id',
	type: 'object',
	properties: {
		id: { type: 'string', maxLength: 100 },
		node_type: { type: 'string' },
		circuit_number: { type: 'number' },
		panel_data: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				terminal_temperature: { type: 'string' },
				phase: { type: 'string' }
			},
			additionalProperties: false
		},
		load_data: {
			type: 'object',
			properties: {
				load_description: { type: 'string' },
				terminal_temperature: { type: 'string' },
				quantity: { type: 'number' },
				varies: { type: 'number' },
				continuous: { type: 'boolean' },
				load_type: { type: 'string' },
				config_preference: { type: 'string' } // bale ang magiging value kani is CUSTOM or DEFAULT para pag nag update, automatic naka set na sa form
			},
			additionalProperties: false,
			required: ['load_description', 'terminal_temperature', 'quantity', 'varies', 'continuous', 'load_type', 'config_preference']
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
