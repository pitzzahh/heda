import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { generic_phase_panel_schema } from '@/schema/panel';
import { getCurrentProject, getRootNode } from '@/db/queries/index.js';
import { generic_phase_main_load_schema } from '@/schema/load';
import { BASE_DIR, generateUniqueFileName, getFileNameWithoutExtension } from '@/helpers/file';

export const load = async ({ parent, depends, url: { searchParams } }) => {
	depends('app:workspace');
	const project = (await getCurrentProject(searchParams.get('project_id') ?? undefined));
	const root_node = (await getRootNode());
	const { app_pass_phrase } = await parent();
	return {
		is_new_file: searchParams.get('new_file') === 'true',
		is_load_file: searchParams.get('load_file') === 'true',
		highest_unit_form: await superValidate(zod(highest_unit_schema)),
		generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema)),
		project_title: project?.project_name ?? getFileNameWithoutExtension(await generateUniqueFileName(project?.project_name ?? "Untitled", BASE_DIR)),
		can_create_project: app_pass_phrase !== null,
		project,
		root_node
	};
};
