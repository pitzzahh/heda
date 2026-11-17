import type * as v from 'valibot';
import type { LOAD_SCHEDULE_ROW_SCHEMA } from '#lib/validators/schedule.js';
import type { Node } from '#lib/types/db.js';

/** A computed load-schedule row: the stored node plus what computeNodeLoad adds. */
export type PhaseLoadSchedule = v.InferOutput<typeof LOAD_SCHEDULE_ROW_SCHEMA> & Node;
