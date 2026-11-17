import type * as v from 'valibot';
import type { VOLTAGE_DROP_RESULT_SCHEMA } from '#lib/validators/voltage-drop.js';
import type { PhaseLoadSchedule } from './schedule.js';

export type VoltageDrop = v.InferOutput<typeof VOLTAGE_DROP_RESULT_SCHEMA> & PhaseLoadSchedule;
