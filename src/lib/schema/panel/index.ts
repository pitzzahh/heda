import { z } from 'zod';

export const generic_panel_schema = z.object({
  main_id: z.string().refine((v) => v, { message: 'A main ID is required.' }),
  main_phase: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
    required_error: 'You need to select a phase'
  }),
  name: z.string().refine((v) => v, { message: 'A panel name is required.' }),
  circuit_number: z
    .number({ message: "Please enter a valid circuit number." })
    .refine((value) => value > 0, {
      message: 'Circuit number must be greater than 0.'
    }),
  panel_ambient_temperature: z
    .string()
    .refine((v) => v, { message: 'A panel ambient temperature is required.' }),
  panel_type: z.enum(['wye', 'delta', 'algo'], {
    required_error: 'You need to select a 3P type'
  }).optional().nullable(),
  panel_phase: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
    required_error: 'You need to select a phase'
  }),
});

export type GenericPanelSchema = z.infer<typeof generic_panel_schema>;
