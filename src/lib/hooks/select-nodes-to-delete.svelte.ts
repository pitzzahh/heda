import { setState, getState } from '@/state/index.svelte';
import { SELECT_NODES_TO_DELETE_CTX } from '@/state/constants';

export class SelectNodesToDelete {
	selected_nodes_id = $state<Set<string>>(new Set());

	constructor() { }

	addOrRemoveNodeId(id: string) {
		if (this.checkIsIdSelected(id)) {
			this.removeNodeId(id);
		} else this.selected_nodes_id.add(id);
	}

	checkIsIdSelected(id: string) {
		return this.selected_nodes_id.has(id);
	}

	removeNodeId(id: string) {
		this.selected_nodes_id.delete(id);
	}

	getSelectedNodeIdsCount() {
		return this.selected_nodes_id.size;
	}

	removeAllNodeIds() {
		this.selected_nodes_id.clear();
	}
}

export function setSelectNodesToDeleteState() {
	return setState(new SelectNodesToDelete(), SELECT_NODES_TO_DELETE_CTX);
}

export function getSelectNodesToDeleteState() {
	return getState<SelectNodesToDelete>(SELECT_NODES_TO_DELETE_CTX);
}
