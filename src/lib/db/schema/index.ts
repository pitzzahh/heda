import { toTypedRxJsonSchema } from 'rxdb';
import type { ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema } from 'rxdb';

export const project = {
	version: 0,
	primaryKey: 'id',
	type: 'object',
	properties: {
		id: { type: 'string', maxLength: 100 },
		highest_unit_form: { type: 'any' },
		tree: {
			type: 'array',
			items: { type: 'string' }
		}
	},
	required: ['id', 'highest_unit_form', 'tree']
} as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typed_project_schema = toTypedRxJsonSchema(project);
export type ProjectSchemaType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_project_schema>;
export const project_schema: RxJsonSchema<ProjectSchemaType> = project;

export const item = {
	version: 0,
	primaryKey: 'id',
	type: 'object',
	properties: {
		id: { type: 'string', maxLength: 100 },
		is_panel: { type: 'number' },
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
				load_description: { type: 'string' },
				quantity: { type: 'number' },
				varies: { type: 'number' },
				is_panel: { type: 'number' },
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
	required: ['id', 'is_panel', 'parent_id', 'child_ids']
} as const;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const typed_item_schema = toTypedRxJsonSchema(item);
// aggregate the document type from the schema
export type ItemSchemaType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_item_schema>;
// create the typed RxJsonSchema from the literal typed object.
export const item_schema: RxJsonSchema<ItemSchemaType> = item;