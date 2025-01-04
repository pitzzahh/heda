import { z } from 'zod';
import {
	DEFAULT_LOAD_TYPES_ENUMS,
	DEFAULT_TERMINAL_TEMPERATURE_ENUMS,
	FIELD_VALIDATION,
	MIN_VARIES
} from '@/constants';
import type { LoadType, TerminalTemperature } from '@/types/load';

export const generic_phase_main_load_schema = z
	.object({
		circuit_number: z
			.number({ message: 'Please enter a valid circuit number.' })
			.refine((value) => value > 0, {
				message: 'Circuit number must be greater than 0.'
			}),
		terminal_temperature: z
			.enum(
				DEFAULT_TERMINAL_TEMPERATURE_ENUMS.map((f) => f.value) as [
					TerminalTemperature,
					...TerminalTemperature[]
				],
				{
					errorMap: () => ({ message: 'Please select a valid terminal temperature.' })
				}
			)
			.default('Standard Temperature'),
		ambient_temperature: z
			.number({
				message: 'Please enter a valid ambient temperature.',
				required_error: 'You need to select an ambient temperature'
			})
			.default(30),
		length: z.number({
			message: 'Please enter a valid length.',
			required_error: 'Length is required'
		}),
		quantity: z.number({ message: 'Please enter a valid quantity.' }).refine((value) => value > 0, {
			message: 'Quantity must be greater than 0.'
		}),
		load_description: z.string().refine((v) => v, { message: 'A load description is required.' }),
		varies: z.string({ message: 'This field is required' }),
		continuous: z.boolean(),
		load_type: z.enum(DEFAULT_LOAD_TYPES_ENUMS.map((f) => f.value) as [LoadType, ...LoadType[]], {
			errorMap: () => ({ message: 'Please select a valid load type.' })
		})
	})
	.superRefine((data, ctx) => {
		if (data.load_type !== '1P Motor - Rated Horse Power') {
			if (!data.varies) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['varies'],
					message: 'This field is required.'
				});
			}
			if (!FIELD_VALIDATION.TEST.ALL_NUMBER(data.varies)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['varies'],
					message: 'This field must be a number.'
				});
			}
		}
	});
export type GenericPhaseMainLoadSchema = z.infer<typeof generic_phase_main_load_schema>;
