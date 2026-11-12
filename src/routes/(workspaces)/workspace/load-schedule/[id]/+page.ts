import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { nodeIdFromRouteId } from '#lib/helpers/navigation/index.js';

export const entries = () => {
	return [{ id: 'some-id' }, { id: 'other-id' }];
};

export const load = async ({ params }) => {
	// No `depends('app:workspace/load-schedule')`: this load runs only when
	// `params` change. Tables derive live rows from SignalDB cursors keyed by
	// the current node id, so a field edit recomputes only the schedule it
	// touched, never the layout.
	const node_id = nodeIdFromRouteId(params.id);
	if (!node_id) {
		console.warn('Viewing workspace without node_id');
		goto(resolve('/'));
	}
	return {};
};
