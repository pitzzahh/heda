import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { generic_phase_panel_schema } from '@/schema/panel';
import { getCurrentProject, getRootNode } from '@/db/queries/index.js';
import { generic_phase_main_load_schema } from '@/schema/load';

export const load = async ({ depends, url: { searchParams } }) => {
	depends('app:workspace');
	const project = (await getCurrentProject());
	const root_node = (await getRootNode());
	return {
		is_new_file: searchParams.get('new_file') === 'true',
		is_load_file: searchParams.get('load_file') === 'true',
		highest_unit_form: await superValidate(zod(highest_unit_schema)),
		generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema)),
		project,
		root_node
	};
};
