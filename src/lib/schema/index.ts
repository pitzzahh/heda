import { z } from 'zod';
import { DEFAULT_PHASES_ENUMS } from '@/constants';
import type { Phase } from '@/types/phase';

export const highest_unit_schema = z.object({
	distribution_unit: z.string().refine((v) => v, { message: 'A distribution unit is required.' }).default('Transformer'),
	phase: z.enum(DEFAULT_PHASES_ENUMS.map((f) => f.value) as [Phase, ...Phase[]], {
		required_error: 'You need to select a phase'
	})
});
export const new_file_schema = z.object({
	id: z.string().optional(),
	file_name: z.string().refine((v) => v, { message: 'An file_name is required.' })
});
export type HighestUnitSchema = z.infer<typeof highest_unit_schema>;
export type NewFileSchema = z.infer<typeof new_file_schema>;
