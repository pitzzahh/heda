import { highest_unit_schema } from '@/schema';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { generic_phase_panel_schema } from '@/schema/panel';
import { generic_phase_main_load_schema } from '@/schema/load';
import { getEnv } from '@/helpers/security/index.js';
import { getCurrentProject, getRootNode } from '@/db/queries/index.js';
import { redirect } from '@sveltejs/kit';

export const load = async ({ depends, url: { searchParams } }) => {
	depends('app:workspace');
	const app_pass_phrase = await getEnv('APP_PASS_PHRASE');
	const file_encryption_salt = await getEnv('FILE_ENCRYPTION_SALT');
	const instance_name = searchParams.get('instance_name');
	const distribution_unit = searchParams.get('distribution_unit');
	const current_project = instance_name ? await getCurrentProject(instance_name) : null;
	const root_node = instance_name ? await getRootNode(instance_name) : null;
	if (current_project && root_node) {
		return redirect(303, `/workspace/load-schedule/${distribution_unit as string}_${root_node.id}?project_title=${instance_name}`)
	}
	return {
		is_new_file: searchParams.get('new_file') === 'true',
		is_load_file: searchParams.get('load_file') === 'true',
		highest_unit_form: await superValidate(zod(highest_unit_schema)),
		generic_phase_panel_form: await superValidate(zod(generic_phase_panel_schema)),
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema)),
		app_pass_phrase,
		file_encryption_salt,
		can_create_project: app_pass_phrase !== null && file_encryption_salt !== null,
		current_project,
		root_node,
	};
};
