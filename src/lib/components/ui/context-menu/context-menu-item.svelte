<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils/index.js';
	import { type MenuItemVariant, menu } from '#lib/components/ui/shared/menu.js';

	let {
		class: classProp,
		variant: variantProp,
		destructive = false,
		inset = false,
		...rest
	}: ContextMenuPrimitive.ItemProps & {
		variant?: MenuItemVariant;
		/** Alias for `variant="destructive"`. */
		destructive?: boolean;
		inset?: boolean;
	} = $props();

	const variant = $derived<MenuItemVariant>(
		variantProp ?? (destructive ? 'destructive' : 'default')
	);
</script>

<ContextMenuPrimitive.Item
	{...rest}
	data-slot="context-menu-item"
	data-inset={inset || undefined}
	class={cn(menu({ variant }).item(), classProp)}
/>
