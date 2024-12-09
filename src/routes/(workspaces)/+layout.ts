import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { databaseInstance } from '@/db';
import { generic_phase_panel_schema } from '@/schema/panel';
import { getCurrentProject, getRootNode } from '@/db/queries/index.js';
import type { Node, Project } from '@/types/project/index.js';

export const load = async ({ url: { searchParams } }) => {
	console.log('INIT DB');
	const database = await databaseInstance();
	console.log(database);

	const project = (await getCurrentProject()) as Project;
	// const nodes = project ? await getChildNodesByParentId(project.id) : [];
	const root_node = (await getRootNode()) as Node;

	return {
		is_new_file: searchParams.get('new_file') === 'true',
		is_load_file: searchParams.get('load_file') === 'true',
		highest_unit_form: await superValidate(zod(highest_unit_schema)),
		generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
		project,
		root_node
	};
};
