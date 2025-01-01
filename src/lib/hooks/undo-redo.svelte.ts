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
};

export class UndoRedoState {
	private undo_stack = $state<Action<PhaseLoadSchedule>[]>([]);
	private redo_stack = $state<Action<PhaseLoadSchedule>[]>([]);

	constructor() {}

	setActionToUndo(action: Action<PhaseLoadSchedule>) {
		this.undo_stack = [...(this.undo_stack ? this.undo_stack : []), action];
	}

	async undo() {
		const last_action = this.undo_stack.pop();
		console.log('last act undo', last_action);
		if (last_action) {
			switch (last_action.action) {
				case 'create_node':
					await removeNode(last_action.data.id);
				case 'update_node':
				case 'delete_node':
				case 'update_project_title':
				case 'copy_node':
			}

			this.redo_stack = [...this.redo_stack, last_action];
			invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
		}
	}

	async redo() {
		const last_action = this.redo_stack.pop();
		console.log('last act redo', last_action);

		if (last_action) {
			switch (last_action.action) {
				case 'create_node':
					const added_node = await addNode({
						existing_id: last_action.data.id,
						parent_id: last_action.data.parent_id as string,
						...(last_action.data.panel_data && {
							panel_data: {
								...last_action.data.panel_data,
								circuit_number: last_action.data.circuit_number
							} as any
						}),
						...(last_action.data.load_data && {
							load_data: {
								...last_action.data.load_data,
								circuit_number: last_action.data.circuit_number
							} as any
						})
					});

					console.log(added_node);

					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, data: added_node as unknown as PhaseLoadSchedule }
					];
				case 'update_node':
				case 'delete_node':
				case 'update_project_title':
				case 'copy_node':
			}

			invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
		}
	}
}

export function setUndoRedoState() {
	return setState(new UndoRedoState(), UNDO_REDO_STATE_CTX);
}

export function getUndoRedoState() {
	return getState<ReturnType<typeof setUndoRedoState>>(UNDO_REDO_STATE_CTX);
}
