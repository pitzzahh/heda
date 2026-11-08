import type * as v from 'valibot';
import type { PHASE_FIELD } from '#lib/validators/shared.js';
import type { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel/index.js';

export type Phase = v.InferOutput<typeof PHASE_FIELD>;

export type PhaseType = Exclude<
	v.InferOutput<typeof GENERIC_PHASE_PANEL_SCHEMA>['type'],
	null | undefined
>;
