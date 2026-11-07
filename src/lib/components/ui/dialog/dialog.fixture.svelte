<script lang="ts" module>
	import type { DialogMotion } from './variants.js';

	interface Props {
		open?: boolean;
		motion?: DialogMotion;
	}
</script>

<script lang="ts">
	import * as Dialog from './index.js';

	let { open = $bindable(false), motion = 'zoom' }: Props = $props();
</script>

<Dialog.Root bind:open {motion}>
	<Dialog.Trigger>Open dialog</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Title>Fixture title</Dialog.Title>
		<p>Fixture body</p>
	</Dialog.Content>
</Dialog.Root>
