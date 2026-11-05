<script lang="ts" module>
	interface Props {
		open?: boolean;
	}
</script>

<script lang="ts">
	import * as Popover from './index.js';

	let { open = $bindable(false) }: Props = $props();
</script>

<Popover.Root bind:open>
	<Popover.Trigger>Open popover</Popover.Trigger>
	<Popover.Content>
		<p>Popover body</p>
	</Popover.Content>
</Popover.Root>
