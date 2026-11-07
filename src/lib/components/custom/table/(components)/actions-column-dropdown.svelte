<script lang="ts" module>
	import {
		ArrowsCounterClockwiseIcon,
		CopyIcon,
		DotsThreeIcon,
		PencilIcon,
		TrashIcon
	} from '#lib/assets/icons';
	import type { Node } from '#lib/types/db';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
	import type { VoltageDrop } from '#lib/types/voltage-drop';

	interface Props {
		node: VoltageDrop | PhaseLoadSchedule;
		highest_unit?: NonNullable<Node['highest_unit_form']>;
		is_in_vd_table?: boolean;
	}
</script>

<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button';
	import { copyAndAddNodeById, removeNode } from '#lib/db/mutations';
	import GenericPhaseMainLoadForm from '#lib/components/custom/load/generic-phase-main-load-form.svelte';
	import { ConfirmationDialog, MultiCopyDialog } from '#lib/components/custom';
	import { getNodeById } from '#lib/db/queries';
	import ParentPanelPopover from '../../parent-panel-popover.svelte';
	import { cn } from '#lib/utils';
	import Separator from '#lib/components/ui/separator/separator.svelte';
	import { toast } from 'svelte-sonner';
	import OverrideSelectors from '../../override-selectors.svelte';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte';

	let { node, highest_unit, is_in_vd_table }: Props = $props();
	const phase = $derived(highest_unit?.phase);

	let is_update_dialog_open = $state(false);
	let is_override_dialog_open = $state(false);
	let open_dropdown_menu = $state(false);
	let is_confirmation_open = $state(false);
	let selected_parent = $state<{ name: string; id: string } | null>(null);
	let node_name = $state('Unknown');
	let open_copy_dialog = $state(false);

	let undo_redo_state = getUndoRedoState();
	const db_revisions = getDbRevisionsState();
	let settings_state = getSettingsState();
	let select_nodes_to_delete_state = getSelectNodesToDeleteState();

	// Loads the parent name for display whenever the row node changes.
	$effect(() => {
		if (node.parent_id) {
			getNodeById(node.parent_id).then((node) => {
				selected_parent = {
					name: node?.highest_unit_form?.distribution_unit || node?.panel_data?.name || '',
					id: node?.id || ''
				};
			});
		}
	});

	async function handleRemoveLoad() {
		const result = await removeNode(node.id);
		if (result) {
			undo_redo_state.setActionToUndo({
				action: 'delete_node',
				data: node,
				children_nodes: result.children_nodes
			});
		}

		db_revisions.bumpWorkspaceAndSchedule();
		toast.success(`Load ${node.load_data?.load_description ?? 'Unknown'} removed successfully.`);
		select_nodes_to_delete_state.removeNodeId(node.id); //remove the node id in the list of ever it is selected
	}

	function isVoltageDrop(data: VoltageDrop | PhaseLoadSchedule): data is VoltageDrop {
		return typeof (data as VoltageDrop).z !== 'undefined';
	}

	async function copyNodeById(node_id: string) {
		node_name = node.panel_data?.name || node.load_data?.load_description || 'Unknown';
		if (open_copy_dialog) return;
		await copyAndAddNodeById(node_id).then((copied_node) => {
			undo_redo_state.setActionToUndo({
				action: 'copy_node',
				data: copied_node as unknown as PhaseLoadSchedule
			});
		});
		db_revisions.bumpWorkspaceAndSchedule();
	}
</script>

<div class="grid w-full place-content-center">
	<DropdownMenu.Root bind:open={open_dropdown_menu}>
		<DropdownMenu.Trigger>
			<Button size="icon" variant="outline">
				<DotsThreeIcon class="size-4" />
			</Button>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.Label>Actions</DropdownMenu.Label>
				<DropdownMenu.Separator />

				{#if node.node_type === 'load' && !is_in_vd_table}
					<DropdownMenu.Item onclick={() => (is_update_dialog_open = true)}>
						<PencilIcon class="ml-2 size-4" />
						Update
					</DropdownMenu.Item>
					<DropdownMenu.Item
						onclick={async () => {
							open_copy_dialog = settings_state.is_load_multi_copy;
							await copyNodeById(node.id);
						}}
					>
						<CopyIcon class="ml-2 size-4" />
						Copy
					</DropdownMenu.Item>
				{/if}

				<DropdownMenu.Item onclick={() => (is_override_dialog_open = true)}>
					<ArrowsCounterClockwiseIcon class="ml-2 size-4" />
					Override
				</DropdownMenu.Item>

				{#if node.node_type === 'load' && !is_in_vd_table}
					<DropdownMenu.Item
						class="text-destructive hover:bg-destructive/10!"
						onclick={() => (is_confirmation_open = true)}
					>
						<TrashIcon class="ml-2 size-4" />
						Delete
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<ConfirmationDialog
	bind:open_dialog_state={is_confirmation_open}
	trigger_text="Remove load"
	trigger_variant="destructive"
	bind:some_open_state={open_dropdown_menu}
	onConfirm={handleRemoveLoad}
/>

<Dialog.Root bind:open={is_update_dialog_open}>
	<Dialog.Content class="w-full max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update load</Dialog.Title>
			<Dialog.Description>Edit the load details.</Dialog.Description>
			<div class={cn('flex flex-col items-center justify-start')}>
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex items-center gap-1">
							<h4 class="font-semibold">Supply From:</h4>
							<!-- <p>{distribution_unit ?? 'N/A'}</p> -->
							{#if selected_parent}
								<ParentPanelPopover
									current_parent_id={node.parent_id || ''}
									bind:selected_parent
									excluded_node_id={node.id}
								/>
							{/if}
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Phase:</h4>
							<p>
								{#if phase == null}
									N/A
								{:else}
									{phase}
								{/if}
							</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<GenericPhaseMainLoadForm
			action="edit"
			selected_parent_id={selected_parent?.id}
			closeDialog={() => (is_update_dialog_open = false)}
			node_to_edit={node}
		/>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_override_dialog_open}>
	<Dialog.Content class="max-w-[450px]">
		<Dialog.Header>
			<Dialog.Title>Override</Dialog.Title>
			<Dialog.Description>
				Override the data of <span class="font-semibold">{node.load_description}</span>
			</Dialog.Description>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<OverrideSelectors
			closeDialog={() => (is_override_dialog_open = false)}
			node_id={node.id}
			current_at={node.overrided_at || node.at}
			current_conductor_size={node.overrided_conductor_size || node.conductor_size}
			current_egc_size={node.overrided_egc_size || node.egc_size}
			current_conduit_size={node.overrided_conduit_size || node.conduit_size}
			current_ampere_frames={node.overrided_ampere_frames || node.ampere_frames}
			current_z={node.overrided_z || (isVoltageDrop(node) && node.z) || 0}
			current_length={(node.overrided_length || node.length) as number}
			overridden_fields={{
				egc_size: !!node.overrided_egc_size,
				at: !!node.overrided_at,
				conductor_size: !!node.overrided_conductor_size,
				conduit_size: !!node.overrided_conduit_size,
				ampere_frames: !!node.overrided_ampere_frames,
				z: !!node.overrided_z,
				length: !!node.overrided_length
			}}
			{is_in_vd_table}
		/>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>

<MultiCopyDialog open_dialog={open_copy_dialog} {node_name} node_id={node.id} />
