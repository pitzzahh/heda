<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils/index.js';
	import { type MenuSize, menu } from '#lib/components/ui/shared/menu.js';
	import { ANCHORED } from '#lib/components/ui/shared/anchor.js';

	let {
		class: classProp,
		size = 'default',
		ref = $bindable(null),
		...rest
	}: ContextMenuPrimitive.ContentProps & { size?: MenuSize } = $props();
</script>

<ContextMenuPrimitive.Portal>
	<ContextMenuPrimitive.Content
		bind:ref
		{...rest}
		data-slot="context-menu-content"
		data-size={size}
		class={cn(ANCHORED, 'static', menu({ size }).surface(), classProp)}
	/>
</ContextMenuPrimitive.Portal>
