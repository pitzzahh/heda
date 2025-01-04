import { generic_phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import {
	getCurrentProject,
	getNodeById,
	getRootNode,
	getComputedLoads,
	getComputedVoltageDrops
} from '@/db/queries/index.js';
import { goto } from '$app/navigation';
import type { Node } from '@/db/schema';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ depends, params }) => {
	depends('app:workspace/load-schedule');
	const node_id = params.id.split('_').at(-1) as string;
	const project = await getCurrentProject();
	const root_node = await getRootNode();

	if (!project || !node_id || !root_node) {
		goto('/workspace');
	}

	const current_node = await getNodeById(node_id);
	if (!current_node) goto('/workspace');

	const nodes = await getComputedLoads(node_id);
	console.log(nodes);

	const voltage_drops = await getComputedVoltageDrops() 

	console.log('curr node ', current_node);
	return {
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema)),
		project,
		nodes: nodes && nodes?.length > 0 ? nodes : [],
		root_node: root_node as Node,
		current_node,
		voltage_drops
	};
};
