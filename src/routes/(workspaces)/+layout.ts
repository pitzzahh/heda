import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { createDatabase } from '@/db';
import { project_schema, item_schema } from '@/db/schema/index.js';
import { generic_phase_panel_schema } from '@/schema/panel';

export const load = (async ({ url: { searchParams } }) => {
  console.log('INIT DB')

  const database = await createDatabase();

  console.log(database);

  // Create the projects collection if it doesn't already exist
  if (!database.projects) {
    const add_project_collections_result = await database.addCollections({
      projects: {
        schema: project_schema
      },
      items: {
        schema: item_schema
      }
    });
    console.log(add_project_collections_result);
  }

  const result = await database.projects.find().exec();

  console.log('result', result)

  return {
    is_new_file: searchParams.get('new_file') === 'true',
    is_load_file: searchParams.get('load_file') === 'true',
    highest_unit_form: await superValidate(zod(highest_unit_schema)),
    generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
    panels: []
  };
});