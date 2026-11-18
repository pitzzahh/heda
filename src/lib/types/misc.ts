import type * as v from 'valibot';
import type {
	BUTTON_STATE_FIELD,
	EXCEL_EXPORT_TYPE_FIELD,
	EXPORT_HEADER_SCHEMA,
	EXPORT_PROCESS_RESULT_SCHEMA,
	OVERRIDE_FIELD_TYPE_FIELD
} from '#lib/validators/misc.js';
import type { Node } from '#lib/types/db.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
import type { VoltageDrop } from '#lib/types/voltage-drop.js';

export type ButtonState = v.InferOutput<typeof BUTTON_STATE_FIELD>;

export type ExcelExportType = v.InferOutput<typeof EXCEL_EXPORT_TYPE_FIELD>;

export type FieldType = v.InferOutput<typeof OVERRIDE_FIELD_TYPE_FIELD>;

export type ExportProcessResult = v.InferOutput<typeof EXPORT_PROCESS_RESULT_SCHEMA>;

export type ExportHeader = v.InferOutput<typeof EXPORT_HEADER_SCHEMA>;

/** The engine's results an export writes: every node, its load-schedule row, and the voltage drops. */
export type ExportInputs = {
	nodes: Node[];
	rows: Record<string, PhaseLoadSchedule>;
	voltage_drops: VoltageDrop[];
};
