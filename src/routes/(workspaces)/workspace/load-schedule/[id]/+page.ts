import { generic_phase_main_load_schema } from '@/schema/load';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import {
	getNodeById,
	getRootNode
} from '@/db/queries/index.js';
import { goto } from '$app/navigation';
import type { Node } from '@/db/schema';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ depends, params, url: { searchParams } }) => {
	depends('app:workspace/load-schedule');
	const node_id = params.id.split('_').at(-1) as string;
	const project_name = searchParams.get('project_name');
	if (!project_name) {
		console.warn('No project name found in the URL');
		return goto('/workspace');
	}
	const root_node = await getRootNode(project_name);
	if (!node_id || !root_node) {
		goto('/workspace');
	}
	const current_node = await getNodeById(node_id, project_name);
	if (!current_node) goto('/workspace');
	return {
		phase_main_load_form: await superValidate(zod(generic_phase_main_load_schema)),
		node_id,
		root_node: root_node as Node,
		current_node
	};
};
