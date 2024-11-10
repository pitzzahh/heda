import { z } from 'zod';

import { ambient_temperatures, FIELD_VALIDATION } from '@/constants';
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
    .string()
    .refine(FIELD_VALIDATION.TEST.ALL_NUMBER, 'Wire length must be a number')
    .refine((value) => Number(value) > 0, {
      message: 'Wire must be greater than 0.'
    }),
  phase: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
    required_error: 'You need to select a phase'
  })
});
export type HighestUnitSchema = z.infer<typeof highest_unit_schema>;