import { getState, setState } from '#lib/state/index.svelte.js';
import { UNDO_REDO_STATE_CTX } from '#lib/state/constants.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel/index.js';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load/index.js';
import {
	addNode,
	copyAndAddNodeById,
	overrideField,
	removeNode,
	updateNode,
	type FieldType
} from '#lib/db/mutations/index.js';

type BatchData = {
	data: PhaseLoadSchedule;
	children_nodes?: PhaseLoadSchedule[];
};

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

	resetUnsavedActions() {
		this.has_unsaved_actions = false;
	}

	setHasUnsavedActions() {
		this.has_unsaved_actions = true;
	}

	resetData() {
		this.undo_stack = [];
		this.redo_stack = [];
	}

	setActionToUndo(action: Action<PhaseLoadSchedule>) {
		this.undo_stack = [...(this.undo_stack ? this.undo_stack : []), action];
		this.setHasUnsavedActions();
	}

	copyNodeById(node_id: string) {
		const copied_node = copyAndAddNodeById(node_id);
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
		const added_node = addNode({
			existing_id: node_data.id,
			parent_id: node_data.parent_id as string,
			...(node_data.panel_data && {
				panel_data: {
					...node_data.panel_data,
					circuit_number: node_data.circuit_number
				} as GenericPhasePanelSchema
			}),
			...(node_data.load_data && {
				load_data: {
					...node_data.load_data,
					circuit_number: node_data.circuit_number
				} as GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' }
			})
		});

		if (children_nodes && children_nodes.length > 0) {
			for (const child_node of children_nodes) {
				this.addNewNode(child_node);
			}
		}

		return added_node;
	}

	private handleBatchOperation(
		last_action: Action<PhaseLoadSchedule>,
		operation: 'add' | 'remove'
	): BatchData[] {
		if (!last_action.batch_data?.length) return [];

		let batch_data = [] as {
			data: PhaseLoadSchedule;
			children_nodes?: PhaseLoadSchedule[];
		}[];

		if (operation === 'add') {
			for (const data of last_action.batch_data) {
				const added_node = this.addNewNode(
					data.data,
					data.children_nodes
				) as unknown as PhaseLoadSchedule;

				batch_data = [...batch_data, { data: added_node, children_nodes: [] }];
			}
		} else {
			for (const data of last_action.batch_data) {
				const result = removeNode(data.data.id);

				if (result) {
					batch_data = [
						...batch_data,
						{ data: result.removed_node, children_nodes: result.children_nodes }
					];
				}
			}
		}

		return batch_data;
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
		const last_action = this.undo_stack.pop();
		this.setHasUnsavedActions();

		if (last_action) {
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
		const last_action = this.redo_stack.pop();
		this.setHasUnsavedActions();

		if (last_action) {
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
