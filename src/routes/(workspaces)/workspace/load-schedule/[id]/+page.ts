import { phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { getCurrentProject, getChildNodesByParentId, getNodeById } from '@/db/queries/index.js';
import { goto } from '$app/navigation';

export const entries = () => {
	// TODO: Fetch entries from db
	return [{ id: 'hello-world' }, { id: 'another-blog-post' }];
};
export const load = async ({ params }) => {
	const node_id = params.id.split('_').at(-1);
	const project = await getCurrentProject();

	if (!project) {
		goto('/workspace');
	}

	if (node_id) {
		const existingNode = await getNodeById(node_id as string);
		if (!existingNode) goto('/workspace');
	}

	// MAIIBA PA KANI ANG SHAPE, PETE DAHIL DUMAN SA COMPUTATION.
	//  PANSAMANTALA MUNA NA LOAD LANG MUNA I RENDER KANG TABLE
	const nodes = await getChildNodesByParentId(node_id as string);
	const loads = nodes
		?.filter((node) => node.node_type === 'load')
		.map((node) => ({ ...node.load_data, id: node.id }));

	return {
		phase_main_load_form: await superValidate(zod(phase_main_load_schema)),
		project,
		nodes: loads && loads?.length > 0 ? loads : []
	};
};
