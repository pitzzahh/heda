import { loadDatabase, createDatabase } from '@/db';
import panel from '@/db/schema/panel.js';
import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Panel } from '@/types/panel';
import * as schema from '@/db/schema';

export const load = (async ({ url: { searchParams } }) => {
  console.log('INIT DB')
  const db = await createDatabase(await loadDatabase('test-panels', 'heda'));
  const insert_test_data = await db.insert(schema.panel).values([
    {
      name: 'Panel 1'
    },
    {
      name: 'Panel 2'
    },
    {
      name: 'Panel 3'
    },
    {
      name: 'Panel 4'
    }
  ]);

  console.log('insert_test_data', insert_test_data);

  return {
    is_new_file: searchParams.get('new_file') === 'true',
    is_load_file: searchParams.get('load_file') === 'true',
    highest_unit_form: await superValidate(zod(highest_unit_schema)),
    panels: await db.select().from(panel) as Panel[]
  };
});