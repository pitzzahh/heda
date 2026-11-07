import type { Node } from '#lib/types/db/index.js';
import type * as v from 'valibot';
import type {
	GENERIC_PHASE_MAIN_LOAD_SCHEMA,
	QUANTITY_LABEL_FIELD,
	VARIES_LABEL_FIELD
} from '#lib/validators/load/index.js';
import type { TERMINAL_TEMPERATURE_FIELD } from '#lib/validators/shared.js';

export type GenericPhaseMainLoadSchema = v.InferOutput<typeof GENERIC_PHASE_MAIN_LOAD_SCHEMA>;

export type LoadType = v.InferOutput<typeof GENERIC_PHASE_MAIN_LOAD_SCHEMA>['load_type'];

export type TerminalTemperature = v.InferOutput<typeof TERMINAL_TEMPERATURE_FIELD>;

// has to put required since load_data in NodeDocType is optional
export type Load = Required<NonNullable<Node['load_data']>>;

export type VariesLabel = v.InferOutput<typeof VARIES_LABEL_FIELD>;
export type QuantityLabel = v.InferOutput<typeof QUANTITY_LABEL_FIELD>;

export type DefaultLoad = {
	description: string;
	varies: string;
	continuous: boolean;
	type: LoadType;
};
