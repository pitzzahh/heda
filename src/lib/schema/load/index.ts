import { z } from 'zod';
import { DEFAULT_LOAD_TYPES_ENUMS, DEFAULT_TERMINAL_TEMPERATURE_ENUMS, MIN_VARIES } from '@/constants';
import type { LoadType, TerminalTemperature } from '@/types/load';

export const phase_main_load_schema = z.object({
	circuit_number: z
		.number({ message: 'Please enter a valid circuit number.' })
		.refine((value) => value > 0, {
			message: 'Circuit number must be greater than 0.'
		}),
	terminal_temperature: z.enum(DEFAULT_TERMINAL_TEMPERATURE_ENUMS.map((f) => f.value) as [TerminalTemperature, ...TerminalTemperature[]], {
		errorMap: () => ({ message: 'Please select a valid terminal temperature.' })
	}).default('Standard Temperature'),
	quantity: z.number({ message: 'Please enter a valid quantity.' }).refine((value) => value > 0, {
		message: 'Quantity must be greater than 0.'
	}),
	load_description: z.string().refine((v) => v, { message: 'A load description is required.' }),
	varies: z
		.number({ message: 'This field is required' })
		.refine((v) => v > MIN_VARIES, { message: `Varies must be greater than ${MIN_VARIES}.` }),
	continuous: z.boolean(),
	load_type: z.enum(DEFAULT_LOAD_TYPES_ENUMS.map((f) => f.value) as [LoadType, ...LoadType[]], {
		errorMap: () => ({ message: 'Please select a valid load type.' })
	})
});
export type PhaseMainLoadSchema = z.infer<typeof phase_main_load_schema>;
