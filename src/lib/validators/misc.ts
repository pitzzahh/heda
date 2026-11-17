import * as v from 'valibot';

export const BUTTON_STATE_FIELD = v.picklist(['idle', 'loading']);

export const EXCEL_EXPORT_TYPE_FIELD = v.picklist(['LOAD_SCHEDULE', 'VOLTAGE_DROP']);

/** Computed fields a user can override from the table. */
export const OVERRIDE_FIELD_TYPE_FIELD = v.picklist([
	'egc_size',
	'conductor_size',
	'at',
	'conduit_size',
	'ampere_frames',
	'length',
	'z'
]);

/** Outcome of writing one export sheet. */
export const EXPORT_PROCESS_RESULT_SCHEMA = v.object({
	valid: v.boolean(),
	message: v.optional(v.string()),
	is_system_error: v.optional(v.boolean()),
	description: v.optional(v.string())
});

/** One header cell of an export sheet, optionally spanning sub-columns. */
export const EXPORT_HEADER_SCHEMA = v.object({
	text: v.string(),
	cols: v.number(),
	subText: v.optional(v.string()),
	sub_cols: v.optional(v.array(v.string()))
});
