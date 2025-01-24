<script lang="ts">
	import { Trash, XCircle } from 'lucide-svelte';
	import { getSelectNodesToDeleteState } from '@/hooks/select-nodes-to-delete.svelte';
	import { removeNode } from '@/db/mutations';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { invalidate } from '$app/navigation';
	import { ConfirmationDialog } from '../..';
	import { fly } from 'svelte/transition';
	import Button from '@/components/ui/button/button.svelte';

	let is_confirmation_dialog_open = $state(false);
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();
	const undo_redo_state = getUndoRedoState();

	const component_state = $state({
		is_confirmation_dialog_open: false,
		button_state: 'stale' as 'stale' | 'processing'
	});

	async function handleRemoveSelectedItems() {
		let results = [] as { data: PhaseLoadSchedule; children_nodes?: PhaseLoadSchedule[] }[];
		component_state.button_state = 'processing';
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

		await invalidate('app:workspace/load-schedule');
		await invalidate('app:workspace');
		select_nodes_to_delete_state.removeAllNodeIds();
		is_confirmation_dialog_open = false;
		component_state.button_state = 'stale';
	}
</script>

{#if select_nodes_to_delete_state.selected_nodes_id.length > 0}
	{@const count = select_nodes_to_delete_state.getSelectedNodeIdsCount()}
	<div
		out:fly={{ y: 50, duration: 300 }}
		in:fly={{ y: 50, duration: 300 }}
		class="fixed bottom-6 right-6 z-[30] rounded-[0.5rem] border bg-sidebar p-4"
	>
		<div class="flex items-center gap-2">
			<Button
				size="default"
				onclick={() => select_nodes_to_delete_state.removeAllNodeIds()}
				variant="outline"><XCircle />Unselect All {count} Items</Button
			>
			<Button
				size="default"
				variant="destructive"
				onclick={() => (is_confirmation_dialog_open = true)}
			>
				<Trash />Remove Selected {count} Items
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
