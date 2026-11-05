import type { Node } from '#lib/types/db';
import type * as v from 'valibot';
import type { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel';

export type GenericPhasePanelSchema = v.InferOutput<typeof GENERIC_PHASE_PANEL_SCHEMA>;

// has to put required since panel_data in NodeDocType is optional
export type Panel = Required<NonNullable<Node['panel_data']>>;
