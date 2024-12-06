import { phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { getCurrentProject, getChildNodesByParentId } from '@/db/queries/index.js';
import { goto } from '$app/navigation';

export const entries = () => {
	// TODO: Fetch entries from db
	return [{ id: 'hello-world' }, { id: 'another-blog-post' }];
};
export const load = async ({ params }) => {
	const project = await getCurrentProject();

	if (!project) {
		goto('/workspace');
	}

	const nodes = await getChildNodesByParentId(params.id.split(' ').at(-1) as string);
	const loads = nodes?.map((node) => node.load_data);

	return {
		phase_main_load_form: await superValidate(zod(phase_main_load_schema)),
		project,
		nodes: loads
	};
};
