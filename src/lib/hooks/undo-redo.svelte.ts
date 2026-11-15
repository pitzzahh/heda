import { untrack } from 'svelte';
import { getState, setState } from '#lib/state/index.svelte.js';
import { UNDO_REDO_STATE_CTX } from '#lib/state/constants.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import {
	copyAndAddNodeById,
	overrideField,
	removeNode,
	removeNodesById,
	restoreNodes,
	updateNode,
	type FieldType
} from '#lib/db/mutations/index.js';

type BatchData = {
	data: PhaseLoadSchedule;
	children_nodes?: PhaseLoadSchedule[];
};

// Each entry holds full node snapshots, so old history is dropped past this depth.
const MAX_HISTORY = 100;

type Action<T extends PhaseLoadSchedule> = {
	previous_data?: T;
	data?: T;
	batch_data?: BatchData[];
	action:
		| 'create_node'
		| 'update_node'
		| 'delete_node'
		| 'copy_node'
		| 'batch_delete'
		| 'batch_copy_node'
		| 'override_at'
		| 'override_af'
		| 'override_conduit_size'
		| 'override_conductor_size'
		| 'override_egc_size'
		| 'override_z'
		| 'override_length';
	children_nodes?: T[];
};
export class UndoRedoState {
	private undo_stack = $state<Action<PhaseLoadSchedule>[]>([]);
	private redo_stack = $state<Action<PhaseLoadSchedule>[]>([]);

	has_unsaved_actions = $state(false);
	/** Bumped on every edit so a save can tell whether newer edits landed while it wrote. */
	edit_version = $state(0);

	/** Pass the `edit_version` a save snapshotted; the flag only clears if nothing changed since. */
	resetUnsavedActions(saved_version?: number) {
		if (saved_version !== undefined && saved_version !== this.edit_version) return;
		this.has_unsaved_actions = false;
	}

	setHasUnsavedActions() {
		// Untracked read: effects call this, and tracking the counter would re-run them forever.
		this.edit_version = untrack(() => this.edit_version) + 1;
		this.has_unsaved_actions = true;
	}

	resetData() {
		this.undo_stack = [];
		this.redo_stack = [];
	}

	private trimHistory() {
		if (this.undo_stack.length > MAX_HISTORY) this.undo_stack = this.undo_stack.slice(-MAX_HISTORY);
		if (this.redo_stack.length > MAX_HISTORY) this.redo_stack = this.redo_stack.slice(-MAX_HISTORY);
	}

	setActionToUndo(action: Action<PhaseLoadSchedule>) {
		this.trimHistory();
		this.undo_stack = [...this.undo_stack, action];
		this.setHasUnsavedActions();
	}

	async copyNodeById(node_id: string) {
		const copied_node = await copyAndAddNodeById(node_id);
		this.setActionToUndo({
			action: 'copy_node',
			data: copied_node as unknown as PhaseLoadSchedule
		});
		return copied_node;
	}

	hasRedoActions() {
		return this.redo_stack.length > 0;
	}

	hasUndoActions() {
		return this.undo_stack.length > 0;
	}

	private addNewNode(node_data: PhaseLoadSchedule, children_nodes?: PhaseLoadSchedule[]) {
		return restoreNodes([{ data: node_data, children_nodes }])[0];
	}

	private handleBatchOperation(
		last_action: Action<PhaseLoadSchedule>,
		operation: 'add' | 'remove'
	): BatchData[] {
		if (!last_action.batch_data?.length) return [];

		if (operation === 'add') {
			// One insert for every subtree; restoring them one node at a time was quadratic.
			return restoreNodes(last_action.batch_data).map((node) => ({
				data: node as unknown as PhaseLoadSchedule,
				children_nodes: []
			}));
		}

		const removed = removeNodesById(last_action.batch_data.map((batch) => batch.data.id));
		return removed.map(({ removed_node, children_nodes }) => ({
			data: removed_node,
			children_nodes
		}));
	}

	private handleFieldOverride({
		is_undo = false,
		field_data,
		field_type,
		node_id,
		action
	}: {
		field_type: FieldType;
		node_id: string;
		is_undo?: boolean;
		field_data?: number;
		action: Action<PhaseLoadSchedule>;
	}) {
		this.trimHistory();
		overrideField({
			unoverride: is_undo,
			field_type,
			node_id: node_id,
			field_data
		});

		if (is_undo) {
			this.redo_stack = [...this.redo_stack, action];
		} else {
			this.undo_stack = [...this.undo_stack, action];
		}
	}

	async undo() {
		this.trimHistory();
		const last_action = this.undo_stack.pop();
		if (last_action) {
			this.setHasUnsavedActions();
			switch (last_action.action) {
				case 'create_node': {
					if (!last_action.data) return;

					const result_in_create_node = removeNode(last_action.data.id);
					if (result_in_create_node) {
						this.redo_stack = [
							...this.redo_stack,
							{
								...last_action,
								children_nodes: result_in_create_node.children_nodes
							}
						];
					}

					break;
				}

				case 'update_node': {
					const previous_data = last_action.previous_data;
					const current_data = last_action.data;

					if (previous_data) {
						const updated_node = updateNode({
							id: previous_data.id,
							whole_data: previous_data,
							parent_id: previous_data.parent_id as string
						});

						this.redo_stack = [
							...this.redo_stack,
							{
								...last_action,
								data: updated_node as unknown as PhaseLoadSchedule,
								previous_data: current_data
							}
						];
					}

					break;
				}

				case 'delete_node': {
					if (!last_action.data) return;

					const added_node = this.addNewNode(last_action.data, last_action.children_nodes);
					this.redo_stack = [
						...this.redo_stack,
						{
							...last_action,
							data: added_node as unknown as PhaseLoadSchedule
						}
					];

					break;
				}

				case 'batch_delete': {
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = this.handleBatchOperation(last_action, 'add');

						this.redo_stack = [
							...this.redo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}

					break;
				}

				case 'batch_copy_node': {
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = this.handleBatchOperation(last_action, 'remove');

						this.redo_stack = [
							...this.redo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}
					break;
				}

				case 'copy_node': {
					if (!last_action.data) return;

					const result_in_copy_node = removeNode(last_action.data.id);
					if (result_in_copy_node) {
						this.redo_stack = [
							...this.redo_stack,
							{
								...last_action,
								children_nodes: result_in_copy_node.children_nodes
							}
						];
					}

					break;
				}

				case 'override_at': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'at',
						node_id: last_action.data.id
					});

					break;
				}
				case 'override_af': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'ampere_frames',
						node_id: last_action.data.id
					});
					break;
				}

				case 'override_conductor_size': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'conductor_size',
						node_id: last_action.data.id
					});
					break;
				}
				case 'override_conduit_size': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'conduit_size',
						node_id: last_action.data.id
					});
					break;
				}
				case 'override_egc_size': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'egc_size',
						node_id: last_action.data.id
					});
					break;
				}

				case 'override_z': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'z',
						node_id: last_action.data.id
					});
					break;
				}

				case 'override_length': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'length',
						node_id: last_action.data.id
					});
					break;
				}
			}
		}
	}

	async redo() {
		this.trimHistory();
		const last_action = this.redo_stack.pop();
		if (last_action) {
			this.setHasUnsavedActions();
			switch (last_action.action) {
				case 'create_node': {
					if (!last_action.data) return;

					const added_node = this.addNewNode(last_action.data, last_action.children_nodes);
					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, data: added_node as unknown as PhaseLoadSchedule }
					];
					break;
				}

				case 'update_node': {
					const previous_data = last_action.previous_data;
					const current_data = last_action.data;

					if (previous_data) {
						const updated_node = updateNode({
							id: previous_data.id,
							whole_data: previous_data,
							parent_id: previous_data.parent_id as string
						});

						this.undo_stack = [
							...this.undo_stack,
							{
								...last_action,
								data: updated_node as unknown as PhaseLoadSchedule,
								previous_data: current_data
							}
						];
					}
					break;
				}

				case 'delete_node': {
					if (!last_action.data) return;

					const result = removeNode(last_action.data.id);
					if (result) {
						this.undo_stack = [
							...this.undo_stack,
							{ ...last_action, children_nodes: result.children_nodes }
						];
					}
					break;
				}

				case 'batch_delete': {
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = this.handleBatchOperation(last_action, 'remove');

						this.undo_stack = [
							...this.undo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}
					break;
				}

				case 'copy_node': {
					if (!last_action.data) return;

					const added_copied_node = this.addNewNode(last_action.data, last_action.children_nodes);
					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, data: added_copied_node as unknown as PhaseLoadSchedule }
					];
					break;
				}

				case 'batch_copy_node': {
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = this.handleBatchOperation(last_action, 'add');

						this.undo_stack = [
							...this.undo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}
					break;
				}
				case 'override_at': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						field_data: last_action.data.overrided_at as number,
						action: last_action,
						field_type: 'at',
						node_id: last_action.data.id
					});
					break;
				}
				case 'override_af': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						field_data: last_action.data.overrided_ampere_frames as number,
						action: last_action,
						field_type: 'ampere_frames',
						node_id: last_action.data.id
					});
					break;
				}

				case 'override_conductor_size': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						field_data: last_action.data.overrided_conductor_size as number,
						action: last_action,
						field_type: 'conductor_size',
						node_id: last_action.data.id
					});
					break;
				}
				case 'override_conduit_size': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						field_data: last_action.data.overrided_conduit_size as number,
						action: last_action,
						field_type: 'conduit_size',
						node_id: last_action.data.id
					});
					break;
				}
				case 'override_egc_size': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						field_data: last_action.data.overrided_egc_size as number,
						action: last_action,
						field_type: 'egc_size',
						node_id: last_action.data.id
					});
					break;
				}
				case 'override_z': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						field_data: last_action.data.overrided_z as number,
						action: last_action,
						field_type: 'z',
						node_id: last_action.data.id
					});
					break;
				}
				case 'override_length': {
					if (!last_action.data) return;

					this.handleFieldOverride({
						field_data: last_action.data.overrided_length as number,
						action: last_action,
						field_type: 'length',
						node_id: last_action.data.id
					});
					break;
				}
			}
		}
	}
}

export function setUndoRedoState() {
	return setState(new UndoRedoState(), UNDO_REDO_STATE_CTX);
}

export function getUndoRedoState() {
	return getState<ReturnType<typeof setUndoRedoState>>(UNDO_REDO_STATE_CTX);
}
