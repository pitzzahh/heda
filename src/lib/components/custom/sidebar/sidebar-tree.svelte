<script module lang="ts">
	import type { Node, Project } from '#lib/types/db/index.js';

	interface Props {
		node: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		project?: Project;
		/** Scroll container owned by the sidebar; the tree only renders its window. */
		scroll_element?: HTMLElement | null;
	}

	interface ComponentState {
		open_copy_dialog: boolean;
		node_id: string;
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
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { getChildNodesByParentId, getNodeById } from '#lib/db/queries/index.js';
	import { VirtualWindow } from '#lib/hooks/virtual-window.svelte.js';
	import { flattenVisibleTree } from './tree-rows.js';

	let { node, highest_unit, project, scroll_element = null }: Props = $props();

	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();
	const collapsibles = getCollapsiblesState();

	let component_state: ComponentState = $state({
		open_copy_dialog: false,
		node_id: '',
		node_name: '',
		button_state: 'stale',
		open_tree_delete_dialog: false,
		is_alt_pressed: false
	});

	// Collapsed units and hidden loads are filtered out before rendering, so the
	// virtualizer only ever sees the rows the user can actually reach. Flattening
	// also stops at collapsed nodes, which keeps large hierarchies cheap.
	const rows = $derived(
		flattenVisibleTree(node, {
			is_expanded: (node_id) => collapsibles.checkIsIdExisting(node_id),
			show_loads: settings_state.show_loads_on_unit_hierarchy,
			get_children: getChildNodesByParentId
		})
	);

	const virtual = new VirtualWindow({
		estimate_size: 36,
		overscan: 8,
		initial_render_count: 20,
		get_item_key: (index) => rows[index]?.node.id ?? String(index)
	});

	// Mounts the external virtualizer; returns its observer cleanup on teardown.
	$effect(() => virtual.mount());

	// Syncs row count and the scroll element; imperative lifecycle calls are
	// required by virtual-core, so this intentionally bridges external state.
	$effect(() => {
		virtual.use_scroll_element(scroll_element);
		virtual.sync(rows.length);
	});

	const visible_rows = $derived.by(() =>
		virtual.visible_items.flatMap((item) => {
			const row = rows[item.index];
			return row ? [{ item, row }] : [];
		})
	);

	function handleCopyRequest(node_id: string, multi_copy: boolean) {
		const target = getNodeById(node_id);
		component_state.node_id = node_id;
		component_state.node_name =
			target?.panel_data?.name || target?.load_data?.load_description || 'Unknown';
		component_state.open_copy_dialog = multi_copy;
		if (multi_copy) return;
		undo_redo_state.copyNodeById(node_id);
	}

	function handleDeleteRequest(target: Node) {
		component_state.node_id = target.id;
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

<li class="relative w-full" style:height="{virtual.content_size}px">
	{#each visible_rows as { item, row } (item.key)}
		<div
			{@attach virtual.measure}
			data-index={item.index}
			class="absolute inset-x-0 top-0 w-full"
			style:transform="translateY({item.start}px)"
			style:padding-left="{row.depth * 25}px"
			style:padding-right="{row.depth * 14}px"
		>
			{#if row.node.node_type === 'load'}
				<TreeLoadItem
					node={row.node}
					{highest_unit}
					is_alt_pressed={component_state.is_alt_pressed}
					on_copy={handleCopyRequest}
					on_delete={() => handleDeleteRequest(row.node)}
				/>
			{:else}
				<TreeUnitItem
					node={row.node}
					{highest_unit}
					{project}
					is_alt_pressed={component_state.is_alt_pressed}
					on_copy={handleCopyRequest}
					on_delete={() => handleDeleteRequest(row.node)}
				/>
			{/if}
		</div>
	{/each}
</li>

{#if component_state.node_id}
	<TreeDeleteDialog
		node={getNodeById(component_state.node_id) ?? node}
		{project}
		bind:open={component_state.open_tree_delete_dialog}
		bind:button_state={component_state.button_state}
	/>
{/if}

<MultiCopyDialog
	bind:open_dialog={component_state.open_copy_dialog}
	node_name={component_state.node_name}
	node_id={component_state.node_id}
/>
