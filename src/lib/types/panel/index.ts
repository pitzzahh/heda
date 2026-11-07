import type { Node } from '#lib/types/db/index.js';
import type * as v from 'valibot';
import type { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel/index.js';

export type GenericPhasePanelSchema = v.InferOutput<typeof GENERIC_PHASE_PANEL_SCHEMA>;

// has to put required since panel_data in NodeDocType is optional
export type Panel = Required<NonNullable<Node['panel_data']>>;
