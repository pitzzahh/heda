import { z } from 'zod';
import { specials, MIN_VARIES, MAX_VARIES } from '@/constants';
import type { Special } from '@/types/misc';

export const phase_main_load_schema = z.object({
	circuit_number: z
		.number({ message: 'Please enter a valid circuit number.' })
		.refine((value) => value > 0, {
			message: 'Circuit number must be greater than 0.'
		}),
	load_ambient_temperature: z
		.string()
		.refine((v) => v, { message: 'An ambient temperature is required.' }),
	quantity: z.number({ message: 'Please enter a valid quantity.' }).refine((value) => value > 0, {
		message: 'Quantity must be greater than 0.'
	}),
	load_description: z.string().refine((v) => v, { message: 'A load description is required.' }),
	varies: z
		.number()
		.refine((v) => v > MIN_VARIES, { message: `Varies must be greater than ${MIN_VARIES}.` })
		.refine((v) => v <= MAX_VARIES, {
			message: `Varies must be less than or equal to ${MAX_VARIES}`
		}),
	continuous: z.boolean(),
	special: z.enum(specials.map((f) => f.value) as [Special, ...Special[]], {
		errorMap: () => ({ message: 'Please select a valid special.' })
	})
});
export type PhaseMainLoadSchema = z.infer<typeof phase_main_load_schema>;
