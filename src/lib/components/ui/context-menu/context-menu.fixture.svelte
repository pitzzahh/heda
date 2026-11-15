<script lang="ts" module>
	interface Props {
		open?: boolean;
	}
</script>

<script lang="ts">
	import * as ContextMenu from './index.js';

	let { open = $bindable(false) }: Props = $props();
</script>

<ContextMenu.Root bind:open>
	<ContextMenu.Trigger>
		<p>Right-click area</p>
	</ContextMenu.Trigger>
	<ContextMenu.Content>
		<ContextMenu.Item>First item</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
