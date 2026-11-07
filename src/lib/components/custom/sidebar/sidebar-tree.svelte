<script module lang="ts">
	import type { Node, Project } from '#lib/types/db/index.js';

	interface Props {
		node: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		project?: Project;
	}

	interface ComponentState {
		open_copy_dialog: boolean;
		node_name: string;
		button_state: 'stale' | 'processing';
		open_tree_delete_dialog: boolean;
		is_alt_pressed: boolean;
	}
</script>

<script lang="ts">
	import { TreeDeleteDialog, TreeLoadItem, TreeUnitItem } from './(components)/index.js';
	import MultiCopyDialog from '#lib/components/custom/multi-copy-dialog.svelte';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { node, highest_unit, project }: Props = $props();

	const undo_redo_state = getUndoRedoState();

	let component_state: ComponentState = $state({
		open_copy_dialog: false,
		node_name: '',
		button_state: 'stale',
		open_tree_delete_dialog: false,
		is_alt_pressed: false
	});

	function copyNodeById(node_id: string) {
		component_state.node_name =
			node.panel_data?.name || node.load_data?.load_description || 'Unknown';
		if (component_state.open_copy_dialog) return;
		undo_redo_state.copyNodeById(node_id);
	}

	function handleCopyRequest(node_id: string, multi_copy: boolean) {
		component_state.open_copy_dialog = multi_copy;
		copyNodeById(node_id);
	}

	function handleDeleteRequest() {
		component_state.open_tree_delete_dialog = true;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Alt') component_state.is_alt_pressed = true;
	}}
	onkeyup={(e) => {
		if (e.key === 'Alt') component_state.is_alt_pressed = false;
	}}
	onfocus={() => {
		component_state.is_alt_pressed = false;
	}}
/>

{#if node.node_type === 'load'}
	<TreeLoadItem
		{node}
		{highest_unit}
		is_alt_pressed={component_state.is_alt_pressed}
		on_copy={handleCopyRequest}
		on_delete={handleDeleteRequest}
	/>
{:else}
	<TreeUnitItem
		{node}
		{highest_unit}
		{project}
		is_alt_pressed={component_state.is_alt_pressed}
		on_copy={handleCopyRequest}
		on_delete={handleDeleteRequest}
	/>
{/if}

<TreeDeleteDialog
	{node}
	{project}
	bind:open={component_state.open_tree_delete_dialog}
	bind:button_state={component_state.button_state}
/>

<MultiCopyDialog
	bind:open_dialog={component_state.open_copy_dialog}
	node_name={component_state.node_name}
	node_id={node.id}
/>
