import { setState, getState } from '@/state/index.svelte';
import { SELECT_NODES_TO_DELETE_CTX } from '@/state/constants';

export class SelectNodesToDelete {
	selected_nodes_id = $state<string[]>([]);

	constructor() { }

	addOrRemoveNodeId(id: string) {
		if (this.checkIsIdSelected(id)) {
			this.removeNodeId(id);
		} else this.selected_nodes_id = [...this.selected_nodes_id, id];
	}

	checkIsIdSelected(id: string) {
		return this.selected_nodes_id.includes(id);
	}

	removeNodeId(id: string) {
		this.selected_nodes_id = this.selected_nodes_id.filter((node_id) => node_id !== id);
	}

	getSelectedNodeIdsCount() {
		return this.selected_nodes_id.length
	}

	removeAllNodeIds() {
		this.selected_nodes_id = [];
	}
}

export function setSelectNodesToDeleteState() {
	return setState(new SelectNodesToDelete(), SELECT_NODES_TO_DELETE_CTX);
}

export function getSelectNodesToDeleteState() {
	return getState<SelectNodesToDelete>(SELECT_NODES_TO_DELETE_CTX);
}
