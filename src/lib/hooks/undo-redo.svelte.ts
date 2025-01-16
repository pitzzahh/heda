import { getState, setState } from '@/state/index.svelte';
import { UNDO_REDO_STATE_CTX } from '@/state/constants';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';
import { addNode, overrideField, removeNode, updateNode, type FieldType } from '@/db/mutations';
import { invalidate } from '$app/navigation';

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

	constructor() { }

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

	private async handleBatchOperation(
		last_action: Action<PhaseLoadSchedule>,
		operation: 'add' | 'remove'
	): Promise<BatchData[]> {
		if (!last_action.batch_data?.length) return [];

		let batch_data = [] as {
			data: PhaseLoadSchedule;
			children_nodes?: PhaseLoadSchedule[];
		}[];

		if (operation === 'add') {
			for (const data of last_action.batch_data) {
				const added_node = (await this.addNewNode(
					data.data,
					data.children_nodes
				)) as unknown as PhaseLoadSchedule;

				batch_data = [...batch_data, { data: added_node, children_nodes: [] }];
			}
		} else {
			for (const data of last_action.batch_data) {
				const result = await removeNode(data.data.id);

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

	private async handleFieldOverride({
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
		await overrideField({
			unoverride: is_undo,
			field_type,
			node_id: node_id,
			field_data
		});

		is_undo
			? (this.redo_stack = [...this.redo_stack, action])
			: (this.undo_stack = [...this.undo_stack, action]);
	}

	async undo() {
		const last_action = this.undo_stack.pop();
		this.setHasUnsavedActions();

		if (last_action) {
			switch (last_action.action) {
				case 'create_node':
					if (!last_action.data) return;

					const result_in_create_node = await removeNode(last_action.data.id);
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

				case 'update_node':
					const previous_data = last_action.previous_data;
					const current_data = last_action.data;

					if (previous_data) {
						const updated_node = await updateNode({
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

				case 'delete_node':
					if (!last_action.data) return;

					const added_node = await this.addNewNode(last_action.data, last_action.children_nodes);
					this.redo_stack = [
						...this.redo_stack,
						{
							...last_action,
							data: added_node as unknown as PhaseLoadSchedule
						}
					];

					break;

				case 'batch_delete':
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = await this.handleBatchOperation(last_action, 'add');

						this.redo_stack = [
							...this.redo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}

					break;

				case 'batch_copy_node':
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = await this.handleBatchOperation(last_action, 'remove');

						this.redo_stack = [
							...this.redo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}
					break;

				case 'copy_node':
					if (!last_action.data) return;

					const result_in_copy_node = await removeNode(last_action.data.id);
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

				case 'override_at':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'at',
						node_id: last_action.data.id
					});

					break;
				case 'override_af':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'ampere_frames',
						node_id: last_action.data.id
					});
					break;

				case 'override_conductor_size':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'conductor_size',
						node_id: last_action.data.id
					});
					break;
				case 'override_conduit_size':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'conduit_size',
						node_id: last_action.data.id
					});
					break;
				case 'override_egc_size':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'egc_size',
						node_id: last_action.data.id
					});
					break;

				case 'override_z':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'z',
						node_id: last_action.data.id
					});
					break;

				case 'override_length':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						is_undo: true,
						action: last_action,
						field_type: 'length',
						node_id: last_action.data.id
					});
					break;
			}
			await invalidate('app:workspace');
			await invalidate('app:workspace/load-schedule');
		}
	}

	async redo() {
		const last_action = this.redo_stack.pop();
		this.setHasUnsavedActions();

		if (last_action) {
			switch (last_action.action) {
				case 'create_node':
					if (!last_action.data) return;

					const added_node = await this.addNewNode(last_action.data, last_action.children_nodes);
					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, data: added_node as unknown as PhaseLoadSchedule }
					];
					break;

				case 'update_node':
					const previous_data = last_action.previous_data;
					const current_data = last_action.data;

					if (previous_data) {
						const updated_node = await updateNode({
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

				case 'delete_node':
					if (!last_action.data) return;

					const result = await removeNode(last_action.data.id);
					if (result) {
						this.undo_stack = [
							...this.undo_stack,
							{ ...last_action, children_nodes: result.children_nodes }
						];
					}
					break;

				case 'batch_delete':
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = await this.handleBatchOperation(last_action, 'remove');

						this.undo_stack = [
							...this.undo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}
					break;

				case 'copy_node':
					if (!last_action.data) return;

					const added_copied_node = await this.addNewNode(
						last_action.data,
						last_action.children_nodes
					);
					this.undo_stack = [
						...this.undo_stack,
						{ ...last_action, data: added_copied_node as unknown as PhaseLoadSchedule }
					];
					break;

				case 'batch_copy_node':
					if (last_action.batch_data && last_action.batch_data.length > 0) {
						const batch_data = await this.handleBatchOperation(last_action, 'add');

						this.undo_stack = [
							...this.undo_stack,
							{
								...last_action,
								batch_data
							}
						];
					}
					break;
				case 'override_at':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						field_data: last_action.data.overrided_at as number,
						action: last_action,
						field_type: 'at',
						node_id: last_action.data.id
					});
					break;
				case 'override_af':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						field_data: last_action.data.overrided_ampere_frames as number,
						action: last_action,
						field_type: 'ampere_frames',
						node_id: last_action.data.id
					});
					break;

				case 'override_conductor_size':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						field_data: last_action.data.overrided_conductor_size as number,
						action: last_action,
						field_type: 'conductor_size',
						node_id: last_action.data.id
					});
					break;
				case 'override_conduit_size':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						field_data: last_action.data.overrided_conduit_size as number,
						action: last_action,
						field_type: 'conduit_size',
						node_id: last_action.data.id
					});
					break;
				case 'override_egc_size':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						field_data: last_action.data.overrided_egc_size as number,
						action: last_action,
						field_type: 'egc_size',
						node_id: last_action.data.id
					});
					break;
				case 'override_z':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						field_data: last_action.data.overrided_z as number,
						action: last_action,
						field_type: 'z',
						node_id: last_action.data.id
					});
					break;
				case 'override_length':
					if (!last_action.data) return;

					await this.handleFieldOverride({
						field_data: last_action.data.overrided_length as number,
						action: last_action,
						field_type: 'length',
						node_id: last_action.data.id
					});
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
