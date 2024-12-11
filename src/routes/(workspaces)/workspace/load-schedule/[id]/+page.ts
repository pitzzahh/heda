import { phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import {
	getCurrentProject,
	getNodeById,
	getRootNode,
	getComputedLoads
} from '@/db/queries/index.js';
import { goto } from '$app/navigation';
import type { Node } from '@/types/project/index.js';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ params }) => {
	const node_id = params.id.split('_').at(-1) as string;
	const project = await getCurrentProject();
	const root_node = await getRootNode();

	if (!project || !node_id || !root_node) {
		goto('/workspace');
	}

	const current_node = await getNodeById(node_id);
	if (!current_node) goto('/workspace');

	// MAIIBA PA KANI ANG SHAPE, PETE DAHIL DUMAN SA COMPUTATION.
	//  PANSAMANTALA MUNA NA LOAD LANG MUNA I RENDER KANG TABLE
	const nodes = await getComputedLoads(node_id);

	// TODO: CREATE A SEPARATE QUERY THAT ALSO GETS THE PANEL WITH ITS COMPUTED VALUES AND CREATE ITS SEPARATE TYPE
	// NOTE:  bawal ang nested objects digdi. bale magibo kita separate query for computed child panels and loads na maga match sa accesor key kang table
	// const loads = nodes?.filter((node) => node.node_type === 'load');

	return {
		phase_main_load_form: await superValidate(zod(phase_main_load_schema)),
		project,
		nodes: nodes && nodes?.length > 0 ? nodes : [],
		root_node: root_node as Node
	};
};
