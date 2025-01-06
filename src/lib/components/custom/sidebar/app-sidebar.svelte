<script lang="ts">
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { SidebarHeader, SidebarTree } from '.';
	import Button from '@/components/ui/button/button.svelte';
	import { PlusIcon } from '@/assets/icons';
	import type { DialogState } from '@/state/types';
	import { getState } from '@/state/index.svelte';
	import { DIALOG_STATE_CTX } from '@/state/constants';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { Project } from '@/db/schema';
	import type { Node } from '@/db/schema';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';
	import { Trash, XCircle } from 'lucide-svelte';
	import { getSelectNodesToDeleteState } from '@/hooks/select-nodes-to-delete.svelte';
	import { removeNode } from '@/db/mutations';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { invalidate } from '$app/navigation';
	import { ConfirmationDialog } from '..';
	import { fly } from 'svelte/transition';

	let {
		ref = $bindable(null),
		generic_phase_panel_form,
		phase_main_load_form,
		project,
		root_node,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
		phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>;
		project?: Project;
		root_node: Node;
	} = $props();

	let is_confirmation_dialog_open = $state(false);
	
	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();
	const undo_redo_state = getUndoRedoState();

	async function handleRemoveSelectedItems() {
		for (const node_id of select_nodes_to_delete_state.selected_nodes_id) {
			const result = await removeNode(node_id);

			if (result) {
				undo_redo_state.setActionToUndo({
					data: result?.removed_node as PhaseLoadSchedule,
					action: 'delete_node',
					children_nodes: result.children_nodes
				});
			}
		}

		await invalidate('app:workspace/load-schedule');
		await invalidate('app:workspace');
		select_nodes_to_delete_state.removeAllNodeIds();
		is_confirmation_dialog_open = false;
	}
</script>

{#if select_nodes_to_delete_state.selected_nodes_id.length > 0}
	<div
		out:fly={{ y: -50, duration: 300 }}
		in:fly={{ y: -50, duration: 300 }}
		class="fixed right-6 top-6 z-[30] rounded-[0.5rem] border bg-sidebar p-4"
	>
		<div class="flex items-center gap-2">
			<Button
				size="default"
				onclick={() => select_nodes_to_delete_state.removeAllNodeIds()}
				variant="outline"><XCircle />Unselect All Items</Button
			>
			<Button
				size="default"
				variant="destructive"
				onclick={() => (is_confirmation_dialog_open = true)}
			>
				<Trash />Remove Selected Items
			</Button>
		</div>
	</div>

	<ConfirmationDialog
		bind:open_dialog_state={is_confirmation_dialog_open}
		trigger_text="Remove Items"
		trigger_variant="destructive"
		onConfirm={handleRemoveSelectedItems}
	/>
{/if}

<Sidebar.Root bind:ref {...restProps}>
	<SidebarHeader {project} {root_node} />
	<Sidebar.Content class="overflow-y-auto">
		<Sidebar.Group>
			<Sidebar.GroupLabel>System Hierarchy</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if root_node?.highest_unit_form}
						<svelte:boundary>
							<SidebarTree
								node={root_node}
								highest_unit={root_node.highest_unit_form}
								{phase_main_load_form}
								{generic_phase_panel_form}
								{project}
							/>

							{#snippet failed(error, reset)}
								<p class="text-sm text-muted-foreground">{error}</p>
								<Button onclick={reset}>oops! try again</Button>
							{/snippet}
						</svelte:boundary>
					{:else}
						<div class="grid h-[85vh] place-content-center">
							<div class="grid gap-2">
								<div class="text-center">
									<p class="text-lg font-bold text-muted-foreground">There is no project yet.</p>
									<p class="text-sm text-muted-foreground">Create a new project to get started.</p>
								</div>

								<!-- OPENS THE HIGHEST UNIT FORM IF THERE'S NO EXISTING PROJECT -->
								<Button
									size="sm"
									onclick={() => (dialogs_state.highestUnit = true)}
									href="/workspace?new_file=true"
								>
									<PlusIcon className="size-4 ml-3" /> Create a project
								</Button>
							</div>
						</div>
					{/if}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>
