import { z } from 'zod';
import { DEFAULT_PHASES_ENUMS } from '@/constants';
import type { Phase } from '@/types/phase';	

export const highest_unit_schema = z.object({
	distribution_unit: z.string().refine((v) => v, { message: 'A distribution unit is required.' }),
	phase: z.enum(DEFAULT_PHASES_ENUMS.map((f) => f.value) as [Phase, ...Phase[]], {
		required_error: 'You need to select a phase'
	})
});
export type HighestUnitSchema = z.infer<typeof highest_unit_schema>;
