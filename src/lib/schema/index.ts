import { z } from 'zod';

import { ambient_temperatures, MIN_WIRE_LENGTH } from '@/constants';
import type { Temperature } from '@/types/misc';

export const highest_unit_schema = z.object({
  distribution_unit: z.string().refine((v) => v, { message: 'A distribution unit is required.' }),
  ambient_temp: z.enum(
    ambient_temperatures.map((f) => f.value) as [Temperature, ...Temperature[]],
    {
      errorMap: () => ({ message: 'Please select a valid ambient temperature.' })
    }
  ),
  wire_length: z
    .number({ message: "Please enter a valid wire length." })
    .refine((value) => value > MIN_WIRE_LENGTH, {
      message: `Wire length must be greater than ${MIN_WIRE_LENGTH}.`
    }),
  phase: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
    required_error: 'You need to select a phase'
  })
});
export type HighestUnitSchema = z.infer<typeof highest_unit_schema>;