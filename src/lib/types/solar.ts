import type * as v from 'valibot';
import type { SOLAR_PV_SCHEMA } from '#lib/validators/solar.js';

export type SolarPv = v.InferOutput<typeof SOLAR_PV_SCHEMA>;
