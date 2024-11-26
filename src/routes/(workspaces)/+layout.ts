import { loadDatabase, createDatabase } from '@/db';
import panel from '@/db/schema/panel.js';
import { seed } from "drizzle-seed";
import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Panel } from '@/types/panel';
import * as schema from '@/db/schema';

export const load = (async ({ url: { searchParams } }) => {

  const db = await createDatabase(await loadDatabase('test-panels', 'heda'));
  await seed(db, schema, { count: 20 });

  return {
    is_new_file: searchParams.get('new_file') === 'true',
    is_load_file: searchParams.get('load_file') === 'true',
    highest_unit_form: await superValidate(zod(highest_unit_schema)),
    panels: await db.select().from(panel) as Panel[]
  };
});