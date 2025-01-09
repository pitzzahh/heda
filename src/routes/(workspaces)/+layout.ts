import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { generic_phase_panel_schema } from '@/schema/panel';
import { getCurrentProject, getRootNode } from '@/db/queries/index.js';
import { generic_phase_main_load_schema } from '@/schema/load';
import { BASE_DIR, generateUniqueFileName, getEnv } from '@/helpers/security/index.js';

export const load = async ({ depends, url: { searchParams } }) => {
	depends('app:workspace');
	const project_id = searchParams.get('project_id') ?? undefined;
	const project = (await getCurrentProject(project_id));
	const root_node = (await getRootNode());
	const app_pass_phrase = await getEnv('APP_PASS_PHRASE');

	console.log({ project, root_node, app_pass_phrase });

	return {
		is_new_file: searchParams.get('new_file') === 'true',
		is_load_file: searchParams.get('load_file') === 'true',
		highest_unit_form: await superValidate(zod(highest_unit_schema)),
		generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema)),
		project_title: project?.project_name ?? (await generateUniqueFileName(project?.project_name ?? "Untitled", BASE_DIR)).split('.')[0],
		app_pass_phrase,
		can_create_project: app_pass_phrase !== null,
		project,
		root_node
	};
};
