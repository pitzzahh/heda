<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';

	let { open = $bindable(false), ...rest }: ContextMenuPrimitive.RootProps = $props();
</script>

<ContextMenuPrimitive.Root bind:open {...rest} />
