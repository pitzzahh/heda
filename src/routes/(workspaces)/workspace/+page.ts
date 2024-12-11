import { phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = (async ({ depends }) => {
  depends('app:workspace')
  return {
    phase_main_load_form: await superValidate(zod(phase_main_load_schema))
  };
});
