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
    highest_unit_form: { type: 'any' },
    tree: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['id', 'highest_unit_form', 'tree']
} as const;

const item_literal = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
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

const typed_project_schema = toTypedRxJsonSchema(project_schema_literal);
const typed_item_schema = toTypedRxJsonSchema(item_literal);

// aggregate the document type from the schema
export type ProjectDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_project_schema>;
export type ItemDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof typed_item_schema>;

// create the typed RxJsonSchema from the literal typed object.
export const project_schema: RxJsonSchema<ProjectDocType> = project_schema_literal;
export const item_schema: RxJsonSchema<ItemDocType> = item_literal;