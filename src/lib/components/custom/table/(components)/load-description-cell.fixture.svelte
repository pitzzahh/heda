<script lang="ts">
	import LoadDescriptionCell from './load-description-cell.svelte';

	let { node_type, load_description }: { node_type: 'panel' | 'load'; load_description: string } =
		$props();
</script>

<LoadDescriptionCell node_id="node-a" {node_type} {load_description} />
