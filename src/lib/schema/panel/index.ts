import { z } from 'zod';
import type { Phase, PhaseType } from '@/types/phase';
import { DEFAULT_PHASES_ENUMS, DEFAULT_THREE_PHASE_TYPES_ENUMS } from '@/constants';

export const generic_phase_panel_schema = z.object({
  name: z.string().refine((v) => v, { message: 'A panel name is required.' }),
  circuit_number: z
    .number({ message: "Please enter a valid circuit number." })
    .refine((value) => value > 0, {
      message: 'Circuit number must be greater than 0.'
    }),
  ambient_temperature: z
    .string()
    .refine((v) => v, { message: 'A panel ambient temperature is required.' }),
  type: z.enum(DEFAULT_THREE_PHASE_TYPES_ENUMS.map((v) => v.value) as [PhaseType, ...PhaseType[]], {
    required_error: 'You need to select a 3P type'
  }).optional().nullable(),
  phase: z.enum(DEFAULT_PHASES_ENUMS.map((v) => v.value) as [Phase, ...Phase[]], {
    required_error: 'You need to select a phase'
  }),
});

export type GenericPhasePanelSchema = z.infer<typeof generic_phase_panel_schema>;
