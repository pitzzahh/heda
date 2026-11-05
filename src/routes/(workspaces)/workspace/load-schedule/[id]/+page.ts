import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getComputedLoads, getComputedVoltageDrops, getNodeById } from '#lib/db/queries/index.js';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ depends, params }) => {
	depends('app:workspace/load-schedule');

	const node_id = params.id.split('_').at(-1);
	if (!node_id) {
		console.warn('Viewing workspace without node_id');
		goto(resolve('/'));
		return { current_node: null, loads: [], voltage_drops: [] };
	}

	// Fetched in the load so mutations can refresh the tables in place via
	// `invalidate('app:workspace/load-schedule')`, instead of remounting them.
	const [current_node, loads, voltage_drops] = await Promise.all([
		getNodeById(node_id),
		getComputedLoads(node_id),
		getComputedVoltageDrops()
	]);

	return { current_node, loads, voltage_drops };
};
