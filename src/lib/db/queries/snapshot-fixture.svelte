<script lang="ts">
	import { getComputedLoads } from '#lib/db/queries/index.js';

	let { node_id }: { node_id: string } = $props();

	const loads = $derived(getComputedLoads(node_id));
</script>

<p>at:{loads[0]?.at}</p>
