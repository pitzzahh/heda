import { setState, getState } from '@/state/index.svelte';
import { SELECT_NODES_TO_DELETE_CTX } from '@/state/constants';

export class SelectNodesToDelete {
	selected_nodes_id = $state<string[]>([]);
	is_alt_pressed = $state(false);

	constructor() {}

	addOrRemoveNodeId(id: string) {
		if (!this.is_alt_pressed) return;

		if (this.checkIsIdSelected(id)) {
			this.removeNodeId(id);
		} else this.selected_nodes_id = [...this.selected_nodes_id, id];
	}

	checkIsIdSelected(id: string) {
		return this.selected_nodes_id.includes(id);
	}

	setIsAltPressed(is_pressed: boolean) {
		this.is_alt_pressed = is_pressed;
	}
	
	removeNodeId(id: string) {
		this.selected_nodes_id = this.selected_nodes_id.filter((node_id) => node_id !== id);
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
