import { z } from 'zod';

const ambient_temperatures = [
  { label: '60', value: '60' },
  { label: '75', value: '75' },
  { label: '90', value: '90' },
  { label: 'temparature limitation', value: 'default' }
] as const;

type Temperature = (typeof ambient_temperatures)[number]['value'];

export const highest_unit_schema = z.object({
  id: z.string().optional(),
  distribution_unit: z.string().refine((v) => v, { message: 'A distribution unit is required.' }),
  ambient_temp: z.enum(
    ambient_temperatures.map((f) => f.value) as [Temperature, ...Temperature[]],
    {
      errorMap: () => ({ message: 'Please select a valid ambient temperature.' })
    }
  ),
  phase_name: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
    required_error: 'You need to select a phase name'
  })
});
export type HighestUnitSchema = z.infer<typeof highest_unit_schema>;