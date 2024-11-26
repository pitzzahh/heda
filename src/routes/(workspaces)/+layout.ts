import { createDatabase } from '@/db';
import panel from '@/db/schema/panel.js';
import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Panel } from '@/types/panel';

export const load = (async ({ url: { searchParams } }) => {

  const db = await createDatabase('test-panels', 'heda');


  return {
    is_new_file: searchParams.get('new_file') === 'true',
    is_load_file: searchParams.get('load_file') === 'true',
    highest_unit_form: await superValidate(zod(highest_unit_schema)),
    panels: await db.select().from(panel) as Panel[]
  };
});