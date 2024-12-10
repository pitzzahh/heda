import { phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import {
	getCurrentProject,
	getChildNodesByParentId,
	getNodeById,
	getRootNode
} from '@/db/queries/index.js';
import { goto } from '$app/navigation';
import type { Node } from '@/types/project/index.js';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ params }) => {
	const node_id = params.id.split('_').at(-1) as string;
	const project = await getCurrentProject();
	const rootNode = await getRootNode();

	if (!project || !node_id || !rootNode) {
		goto('/workspace');
	}

	const existingNode = await getNodeById(node_id);
	if (!existingNode) goto('/workspace');

	// MAIIBA PA KANI ANG SHAPE, PETE DAHIL DUMAN SA COMPUTATION.
	//  PANSAMANTALA MUNA NA LOAD LANG MUNA I RENDER KANG TABLE
	const nodes = await getChildNodesByParentId(node_id);
	// TODO: CREATE A SEPARATE QUERY THAT ALSO GETS THE PANEL WITH ITS COMPUTED VALUES AND CREATE ITS SEPARATE TYPE
	const loads = nodes
		?.filter((node) => node.node_type === 'load')
		.map((node) => ({ ...node, ...node.load_data })) as Node[];

	// NOTE:  bawal ang nested objects digdi. bale magibo kita separate query for computed child panels and loads na maga match sa accesor key kang table

	return {
		phase_main_load_form: await superValidate(zod(phase_main_load_schema)),
		project,
		nodes: loads && loads?.length > 0 ? loads : [],
		rootNode: rootNode as Node
	};
};
