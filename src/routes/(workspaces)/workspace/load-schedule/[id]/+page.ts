import { phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { getCurrentProject, getChildNodesByParentId, getNodeById } from '@/db/queries/index.js';
import { goto } from '$app/navigation';
import type { Node } from '@/types/project/index.js';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};
export const load = async ({ params }) => {
	const node_id = params.id.split('_').at(-1) as string;
	const project = await getCurrentProject();

	if (!project || !node_id) {
		goto('/workspace');
	}

	const existingNode = await getNodeById(node_id);
	if (!existingNode) goto('/workspace');

	// MAIIBA PA KANI ANG SHAPE, PETE DAHIL DUMAN SA COMPUTATION.
	//  PANSAMANTALA MUNA NA LOAD LANG MUNA I RENDER KANG TABLE
	const nodes = await getChildNodesByParentId(node_id);
	const loads = nodes
		?.filter((node) => node.node_type === 'load')
		.map((node) => ({ ...node.load_data, id: node.id }));

	console.log(nodes);

	return {
		phase_main_load_form: await superValidate(zod(phase_main_load_schema)),
		project,
		nodes: loads && loads?.length > 0 ? loads : [],
		node: existingNode as Node
	};
};
