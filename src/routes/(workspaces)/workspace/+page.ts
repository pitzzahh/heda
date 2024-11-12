import { one_phase_main_load_schema } from '@/schema/load/one_phase';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = (async () => {
  return {
    one_phase_main_load_form: await superValidate(zod(one_phase_main_load_schema))
  };
});
