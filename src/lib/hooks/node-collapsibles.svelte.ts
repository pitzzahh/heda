import { LocalStorage } from './storage.svelte';
export class Collapsibles {
	local_storage: LocalStorage<string[]>;

	constructor() {
		this.local_storage = new LocalStorage<string[]>('collapsible-node-ids', []);
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
		this.local_storage.current = this.local_storage.current.filter((id) => id !== node_id);
	}

	checkIsIdExisting(node_id: string) {
		return this.local_storage.current ? this.local_storage.current.includes(node_id) : false;
	}

	addNodeId(node_id: string) {
		this.local_storage.current = [...this.local_storage.current, node_id];
	}

	removeAllNodeId() {
		this.local_storage.current = [];
	}
}
