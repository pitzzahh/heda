import { z } from 'zod';
import type { Phase, PhaseType } from '@/types/phase';
import { DEFAULT_PHASES_ENUMS, DEFAULT_TERMINAL_TEMPERATURE_ENUMS, DEFAULT_THREE_PHASE_TYPES_ENUMS } from '@/constants';
import type { TerminalTemperature } from '@/types/load';

export const generic_phase_panel_schema = z.object({
  name: z.string().refine((v) => v, { message: 'A panel name is required.' }),
  circuit_number: z
    .number({ message: "Please enter a valid circuit number." })
    .refine((value) => value > 0, {
      message: 'Circuit number must be greater than 0.'
    }),
  terminal_temperature: z.enum(DEFAULT_TERMINAL_TEMPERATURE_ENUMS.map((f) => f.value) as [TerminalTemperature, ...TerminalTemperature[]], {
    errorMap: () => ({ message: 'Please select a valid terminal temperature.' })
  }).default('Standard Temperature'),
  type: z.enum(DEFAULT_THREE_PHASE_TYPES_ENUMS.map((v) => v.value) as [PhaseType, ...PhaseType[]], {
    required_error: 'You need to select a 3P type'
  }).optional().nullable(),
  phase: z.enum(DEFAULT_PHASES_ENUMS.map((v) => v.value) as [Phase, ...Phase[]], {
    required_error: 'You need to select a phase'
  }),
});

export type GenericPhasePanelSchema = z.infer<typeof generic_phase_panel_schema>;
