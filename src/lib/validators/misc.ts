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
