import type { Node } from '#lib/types/db.js';
import type * as v from 'valibot';
import type { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel.js';

export type GenericPhasePanelSchema = v.InferOutput<typeof GENERIC_PHASE_PANEL_SCHEMA>;

// has to put required since panel_data in NodeDocType is optional
export type Panel = Required<NonNullable<Node['panel_data']>>;
