<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { setContext } from 'svelte';

	let { open = $bindable(false), ...rest }: ContextMenuPrimitive.SubProps = $props();

	// Escape inside a submenu closes only that submenu, matching Base UI in the React port.
	setContext('context-menu-sub', { close: () => (open = false) });
</script>

<ContextMenuPrimitive.Sub bind:open {...rest} />
