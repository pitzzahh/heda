import type * as v from 'valibot';
import type {
	BUTTON_STATE_FIELD,
	EXCEL_EXPORT_TYPE_FIELD,
	OVERRIDE_FIELD_TYPE_FIELD
} from '#lib/validators/misc.js';

export type ButtonState = v.InferOutput<typeof BUTTON_STATE_FIELD>;

export type ExcelExportType = v.InferOutput<typeof EXCEL_EXPORT_TYPE_FIELD>;

export type FieldType = v.InferOutput<typeof OVERRIDE_FIELD_TYPE_FIELD>;
