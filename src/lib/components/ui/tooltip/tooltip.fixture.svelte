<script lang="ts" module>
	interface Props {
		open?: boolean;
	}
</script>

<script lang="ts">
	import * as Tooltip from './index.js';

	let { open = $bindable(false) }: Props = $props();
</script>

<Tooltip.Provider>
	<Tooltip.Root bind:open>
		<Tooltip.Trigger>Hover me</Tooltip.Trigger>
		<Tooltip.Content>Tooltip body</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
