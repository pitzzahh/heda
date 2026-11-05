import type * as v from 'valibot';
import type { PHASE_FIELD } from '#lib/validators/shared';
import type { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel';

export type Phase = v.InferOutput<typeof PHASE_FIELD>;

export type PhaseType = Exclude<
	v.InferOutput<typeof GENERIC_PHASE_PANEL_SCHEMA>['type'],
	null | undefined
>;
