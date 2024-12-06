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
		highest_unit_form: {
			type: 'object',
			properties: {
				distribution_unit: { type: 'string' },
				wire_length: { type: 'number' },
				ambient_temperature: { type: 'string' },
				phase: { type: 'string' }
			},
			additionalProperties: false
		},
		project_name: { type: 'string', default: 'Untitled' },
		tree: {
			type: 'array',
			items: { type: 'string' }
		}
	},
	required: ['id', 'highest_unit_form', 'tree']
} as const;

const node_literal = {
	version: 0,
	primaryKey: 'id',
	type: 'object',
	properties: {
		id: { type: 'string', maxLength: 100 },
		node_type: { type: 'string' },
		panel_data: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				circuit_number: { type: 'number' },
				ambient_temperature: { type: 'string' },
				phase: { type: 'string' }
			},
			additionalProperties: false
		},
		load_data: {
			type: 'object',
			properties: {
				circuit_number: { type: 'number' },
				load_description: { type: 'string' },
				ambient_temperature: { type: 'string' },
				quantity: { type: 'number' },
				varies: { type: 'number' },
				continuous: { type: 'number' },
				special: { type: 'string' }
			},
			additionalProperties: false
		},
		parent_id: { type: ['string', 'null'] },
		child_ids: {
			type: 'array',
			items: { type: 'string' }
		}
	},
	required: ['id', 'node_type', 'parent_id', 'child_ids']
} as const;

const typed_project_schema = toTypedRxJsonSchema(project_schema_literal);
const typed_node_schema = toTypedRxJsonSchema(node_literal);

// aggregate the document type from the schema
export type ProjectDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_project_schema>;
export type NodeDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_node_schema>;

// create the typed RxJsonSchema from the literal typed object.
export const project_schema: RxJsonSchema<ProjectDocType> = project_schema_literal;
export const node_schema: RxJsonSchema<NodeDocType> = node_literal;
