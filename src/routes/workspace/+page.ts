import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';

export const load = (async ({ url: { searchParams } }) => {
  // get if new file or load file
  const is_new_file = searchParams.get('new_file') === 'true';
  const is_load_file = searchParams.get('load_file') === 'true';
  return {
    is_new_file,
    is_load_file,
    highest_unit_form: await superValidate(zod(highest_unit_schema))
  };
});