<script lang="ts" module>
	import type { UndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let fixture_state: UndoRedoState | undefined;

	export function get_fixture_undo_state() {
		return fixture_state as UndoRedoState;
	}
</script>

<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import type { Node } from '#lib/types/db/index.js';
	import TreeDeleteDialog from './tree-delete-dialog.svelte';

	fixture_state = setUndoRedoState();
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
