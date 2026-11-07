<script lang="ts">
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import SelectedNodesActions from './selected-nodes-actions.svelte';

	const select_nodes_to_delete_state = setSelectNodesToDeleteState();
	select_nodes_to_delete_state.addOrRemoveNodeId('node-a');
	select_nodes_to_delete_state.addOrRemoveNodeId('node-b');
</script>

<SelectedNodesActions />
