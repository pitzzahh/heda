import { getState, setState } from '@/state/index.svelte';
import { UNDO_REDO_STATE_CTX } from '@/state/constants';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import { addNode, removeNode } from '@/db/mutations';
import { invalidate } from '$app/navigation';

type Action<T extends PhaseLoadSchedule> = {
	// previous_data?: T;
	// new_data: T;
	data: T;
	action: 'create_node' | 'update_node' | 'delete_node' | 'update_project_title' | 'copy_node';
	children_nodes?: T[];
};

export class UndoRedoState {
	private undo_stack = $state<Action<PhaseLoadSchedule>[]>([]);
	private redo_stack = $state<Action<PhaseLoadSchedule>[]>([]);

	constructor() {}

	setActionToUndo(action: Action<PhaseLoadSchedule>) {
		this.undo_stack = [...(this.undo_stack ? this.undo_stack : []), action];
	}

	hasRedoActions() {
		return this.redo_stack.length > 0;
	}

	hasUndoActions() {
		return this.undo_stack.length > 0;
	}

	private async addNewNode(node_data: PhaseLoadSchedule, children_nodes?: PhaseLoadSchedule[]) {
		const added_node = await addNode({
			existing_id: node_data.id,
			parent_id: node_data.parent_id as string,
			...(node_data.panel_data && {
				panel_data: {
					...node_data.panel_data,
					circuit_number: node_data.circuit_number
				} as any
			}),
			...(node_data.load_data && {
				load_data: {
					...node_data.load_data,
					circuit_number: node_data.circuit_number
				} as any
			})
		});

		//we want to revert the deleted node's children as well
		if (children_nodes && children_nodes.length > 0) {
			for (const child_node of children_nodes) {
				await this.addNewNode(child_node);
			}
		}

		return added_node;
	}

	async undo() {
		const last_action = this.undo_stack.pop();

		if (last_action) {
			switch (last_action.action) {
				case 'create_node':
					const removed_node = await removeNode(last_action.data.id);
					this.redo_stack = [
						...this.redo_stack,
						{ ...last_action, children_nodes: removed_node.children_nodes }
					];
					break;

				case 'update_node':
					break;

				case 'delete_node':
					const added_node = await this.addNewNode(last_action.data, last_action.children_nodes);
					this.redo_stack = [
						...this.redo_stack,
						{ ...last_action, data: added_node as unknown as PhaseLoadSchedule }
					];
					break;

				case 'copy_node':
					const removed_copied_node = await removeNode(last_action.data.id);
					this.redo_stack = [
						...this.redo_stack,
						{ ...last_action, children_nodes: removed_copied_node.children_nodes }
					];
					break;
			}
			await invalidate('app:workspace');
			await invalidate('app:workspace/load-schedule');
		}
	}

	async redo() {
		const last_action = this.redo_stack.pop();

		if (last_action) {
			switch (last_action.action) {
				case 'create_node':
					const added_node = await this.addNewNode(last_action.data, last_action.children_nodes);
					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, data: added_node as unknown as PhaseLoadSchedule }
					];
					break;

				case 'update_node':
					break;

				case 'delete_node':
					const removed_node = await removeNode(last_action.data.id);
					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, children_nodes: removed_node.children_nodes }
					];
					break;

				case 'copy_node':
					const added_copied_node = await this.addNewNode(
						last_action.data,
						last_action.children_nodes
					);
					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, data: added_copied_node as unknown as PhaseLoadSchedule }
					];
					break;
			}
			await invalidate('app:workspace');
			await invalidate('app:workspace/load-schedule');
		}
	}
}

export function setUndoRedoState() {
	return setState(new UndoRedoState(), UNDO_REDO_STATE_CTX);
}

export function getUndoRedoState() {
	return getState<ReturnType<typeof setUndoRedoState>>(UNDO_REDO_STATE_CTX);
}
