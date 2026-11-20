<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import type { Node } from '#lib/types/db.js';
	import TreeDeleteDialog from './tree-delete-dialog.svelte';

	setUndoRedoState();
	setCollapsiblesState();
	setSelectNodesToDeleteState();

	const node = {
		id: 'load-1',
		node_type: 'load',
		load_data: { load_description: 'L1' }
	} as unknown as Node;

	let open = $state(true);
	let button_state = $state<'stale' | 'processing'>('stale');
</script>

<TreeDeleteDialog {node} bind:open bind:button_state />
