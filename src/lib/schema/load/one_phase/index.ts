import { z } from 'zod';
import { ambient_temperatures, specials, MIN_VARIES, MAX_VARIES, MIN_WIRE_LENGTH, MAX_WIRE_LENGTH } from '@/constants';
import type { Temperature, Special } from '@/types/misc';

export const one_phase_main_load_schema = z.object({
  distribution_unit: z.string().refine((v) => v, { message: 'A distribution unit is required.' }),
  main_ambient_temp: z.enum(
    ambient_temperatures.map((f) => f.value) as [Temperature, ...Temperature[]],
    {
      errorMap: () => ({ message: 'Please select a valid ambient temperature.' })
    }
  ),
  wire_length: z
    .number({ message: "Please enter a valid wire length." })
    .refine((value) => value > MIN_WIRE_LENGTH, {
      message: `Wire length must be greater than ${MIN_WIRE_LENGTH}.`
    }).refine((value) => value <= MAX_WIRE_LENGTH, {
      message: `Wire length must be less than or equal to ${MAX_WIRE_LENGTH}.`
    }),
  phase: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
    required_error: 'You need to select a phase'
  }),
  circuit_number: z.string().refine((v) => v, { message: 'A circuit number is required.' }),
  load_ambient_temperature: z
    .string()
    .refine((v) => v, { message: 'An ambient temperature is required.' }),
  quantity: z
    .number({ message: "Please enter a valid quantity." })
    .refine((value) => value > 0, {
      message: 'Quantity must be greater than 0.'
    }),
  load_description: z.string().refine((v) => v, { message: 'A load description is required.' }),
  varies: z.number()
    .refine((v) => v > MIN_VARIES, { message: `Varies must be greater than ${MIN_VARIES}.` })
    .refine((v) => v <= MAX_VARIES, { message: `Varies must be less than or equal to ${MAX_VARIES}` }),
  continuous: z.boolean(),
  special: z.enum(
    specials.map((f) => f.value) as [Special, ...Special[]],
    {
      errorMap: () => ({ message: 'Please select a valid special.' })
    }
  ),
})
export type OnePhaseMainLoadSchema = z.infer<typeof one_phase_main_load_schema>;