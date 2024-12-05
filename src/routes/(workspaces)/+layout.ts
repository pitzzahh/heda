import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import type { Panel } from '@/types/panel';
import { createDatabase } from '@/db';
import { project_schema_literal } from '@/db/schema/index.js';
import { generic_phase_panel_schema } from '@/schema/panel';

export const load = (async ({ url: { searchParams } }) => {
  console.log('INIT DB')

  const database = await createDatabase();

  console.log(database);

  // Create the projects collection if it doesn't already exist
  if (!database.projects) {
    const add_project_collections_result = await database.addCollections({
      projects: {
        schema: project_schema_literal
      }
    });
    console.log(add_project_collections_result);
  }

  const init_insert = await database.projects.insert({
    id: new Date().toISOString(),
    highest_unit_form: {
      name: "Transformer"
    },
    tree: [
      {
        id: 1,
        name: "Panel A",
        loads: [
          {
            id: "load-1",
            load_description: "Lighting Circuit",
            quantity: 10,
            varies: 0,
            is_panel: 1,
            continuous: 1,
            special: "Main hallway lights",
            loads: [
              {
                id: "load-1",
                load_description: "Lighting Circuit",
                quantity: 10,
                varies: 0,
                is_panel: 1,
                continuous: 1,
                special: "Main hallway lights"
              },
              {
                id: "load-2",
                load_description: "HVAC System",
                quantity: 1,
                varies: 1,
                is_panel: 0,
                continuous: 1,
                special: "Energy-efficient unit",
              },
            ]
          },
          {
            id: "load-2",
            load_description: "HVAC System",
            quantity: 1,
            varies: 1,
            is_panel: 0,
            continuous: 1,
            special: "Energy-efficient unit",
          },
        ],
      },
      {
        id: 2,
        name: "Panel B",
        loads: [
          {
            id: "load-3",
            load_description: "Server Rack",
            quantity: 5,
            varies: 0,
            is_panel: 0,
            continuous: 1,
            special: "Critical systems",
          },
          {
            id: "load-4",
            load_description: "Elevator",
            quantity: 1,
            varies: 1,
            is_panel: 1,
            continuous: 0,
            special: "Operates during peak hours",
          },
          {
            id: "load-5",
            load_description: "Backup Generator",
            quantity: 2,
            varies: 0,
            is_panel: 0,
            continuous: 1,
            special: "Supports emergency loads",
          },
        ],
      },
      {
        id: 3,
        name: "Panel C",
        loads: [
          {
            id: "load-6",
            load_description: "Office Computers",
            quantity: 15,
            varies: 1,
            is_panel: 0,
            continuous: 0,
            special: "Shared across departments",
          },
        ],
      },
    ] as Panel[]
  })

  await init_insert.patch({
    done: true
  });

  const result = await database.projects.find().exec();

  console.log(result._data)

  return {
    is_new_file: searchParams.get('new_file') === 'true',
    is_load_file: searchParams.get('load_file') === 'true',
    highest_unit_form: await superValidate(zod(highest_unit_schema)),
    generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
    panels: []
  };
});