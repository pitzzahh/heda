import * as v from 'valibot';

export const BUTTON_STATE_FIELD = v.picklist(['idle', 'loading']);

export const EXCEL_EXPORT_TYPE_FIELD = v.picklist(['LOAD_SCHEDULE', 'VOLTAGE_DROP']);
