<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';

	let { ...rest }: ContextMenuPrimitive.GroupProps = $props();
</script>

<ContextMenuPrimitive.Group {...rest} data-slot="context-menu-group" />
