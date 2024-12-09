import { z } from 'zod';
import { ambient_temperatures, MIN_WIRE_LENGTH, DEFAULT_PHASES_ENUMS } from '@/constants';
import type { Temperature } from '@/types/misc';
import type { Phase } from '@/types/phase';

export const highest_unit_schema = z.object({
	distribution_unit: z.string().refine((v) => v, { message: 'A distribution unit is required.' }),
	ambient_temperature: z.enum(
		ambient_temperatures.map((f) => f.value) as [Temperature, ...Temperature[]],
		{
			errorMap: () => ({ message: 'Please select a valid ambient temperature.' })
		}
	),
	wire_length: z
		.number({ message: 'Please enter a valid wire length.' })
		.refine((value) => value > MIN_WIRE_LENGTH, {
			message: `Wire length must be greater than ${MIN_WIRE_LENGTH}.`
		}),
	phase: z.enum(DEFAULT_PHASES_ENUMS.map((f) => f.value) as [Phase, ...Phase[]], {
		required_error: 'You need to select a phase'
	})
});
export type HighestUnitSchema = z.infer<typeof highest_unit_schema>;
