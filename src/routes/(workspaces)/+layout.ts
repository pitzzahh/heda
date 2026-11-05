import { getCurrentProject, getRootNode } from '#lib/db/queries/index.js';

export const load = async ({ depends, url: { searchParams } }) => {
	depends('app:workspace');
	const project = await getCurrentProject(searchParams.get('project_id') ?? undefined);
	const root_node = await getRootNode();
	return {
		is_new_file: searchParams.get('new_file') === 'true',
		project_title: project?.project_name,
		project,
		root_node
	};
};
