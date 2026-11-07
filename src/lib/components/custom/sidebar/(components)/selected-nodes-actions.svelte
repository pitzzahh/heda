<script lang="ts">
	import { TrashIcon, XCircleIcon } from '#lib/assets/icons';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte';
	import { removeNode } from '#lib/db/mutations';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
	import { ConfirmationDialog } from '../..';
	import { fly } from 'svelte/transition';
	import Button from '#lib/components/ui/button/button.svelte';
	import { toast } from 'svelte-sonner';

	let is_confirmation_dialog_open = $state(false);
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();
	const db_revisions = getDbRevisionsState();
	const undo_redo_state = getUndoRedoState();

	const component_state = $state({
		is_confirmation_dialog_open: false,
		button_state: 'stale' as 'stale' | 'processing'
	});

	async function handleRemoveSelectedItems() {
		let results = [] as { data: PhaseLoadSchedule; children_nodes?: PhaseLoadSchedule[] }[];
		component_state.button_state = 'processing';
		const toast_id = toast.loading(
			`Removing ${select_nodes_to_delete_state.selected_nodes_id.length} items`
		);
		for (const node_id of select_nodes_to_delete_state.selected_nodes_id) {
			const result = await removeNode(node_id);

			if (result) {
				results = [
					...results,
					{ data: result.removed_node, children_nodes: result.children_nodes }
				];
			}
		}

		undo_redo_state.setActionToUndo({
			action: 'batch_delete',
			batch_data: results
		});

		is_confirmation_dialog_open = false;
		component_state.button_state = 'stale';
		toast.success(
			`${select_nodes_to_delete_state.selected_nodes_id.length} items removed successfully`,
			{ id: toast_id }
		);

		db_revisions.bumpWorkspaceAndSchedule();
		select_nodes_to_delete_state.removeAllNodeIds();
	}
</script>

{#if select_nodes_to_delete_state.selected_nodes_id.length > 0}
	{@const count = select_nodes_to_delete_state.getSelectedNodeIdsCount()}
	<div
		out:fly={{ y: 50, duration: 300 }}
		in:fly={{ y: 50, duration: 300 }}
		class="border-border bg-sidebar fixed right-6 bottom-6 z-30 rounded-lg border p-4"
	>
		<div class="flex items-center gap-2">
			<Button
				size="default"
				onclick={() => select_nodes_to_delete_state.removeAllNodeIds()}
				variant="outline"><XCircleIcon />Unselect All {count} Items</Button
			>
			<Button
				size="default"
				variant="destructive"
				onclick={() => (is_confirmation_dialog_open = true)}
			>
				<TrashIcon />Remove Selected {count} Items
			</Button>
		</div>
	</div>

	<ConfirmationDialog
		bind:open_dialog_state={is_confirmation_dialog_open}
		bind:button_state={component_state.button_state}
		trigger_text="Remove Items"
		trigger_variant="destructive"
		onConfirm={handleRemoveSelectedItems}
	/>
{/if}
