import { COLLAPSIBLES_STATE_CTX } from '@/state/constants';
import { getState, setState } from '@/state/index.svelte';
import { PersistedState } from 'runed';
export class Collapsibles {
	persisted_state: PersistedState<string[]>;

	constructor() {
		this.persisted_state = new PersistedState<string[]>('collapsible-node-ids', []);
	}

	toggleCollapsible(node_id: string) {
		const is_existing = this.checkIsIdExisting(node_id);

		if (!is_existing) {
			this.addNodeId(node_id);
			return;
		}

		this.removeNodeId(node_id);
	}

	removeNodeId(node_id: string) {
		this.persisted_state.current = this.persisted_state.current.filter((id) => id !== node_id);
	}

	checkIsIdExisting(node_id: string) {
		return this.persisted_state.current ? this.persisted_state.current.includes(node_id) : false;
	}

	addNodeId(node_id: string) {
		if (this.checkIsIdExisting(node_id)) return;
		this.persisted_state.current = [...this.persisted_state.current, node_id];
	}

	removeAllNodeId() {
		this.persisted_state.current = [];
	}
}


export function setCollapsiblesState() {
	return setState(new Collapsibles(), COLLAPSIBLES_STATE_CTX);
}

export function getCollapsiblesState() {
	return getState<ReturnType<typeof setCollapsiblesState>>(COLLAPSIBLES_STATE_CTX);
}
