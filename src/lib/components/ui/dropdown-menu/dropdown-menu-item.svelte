<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';
	import { menu } from '#lib/components/ui/shared/menu';

	let {
		class: classProp,
		destructive = false,
		inset = false,
		...rest
	}: DropdownMenuPrimitive.ItemProps & {
		destructive?: boolean;
		inset?: boolean;
	} = $props();

	const variant = $derived(destructive ? 'destructive' : 'default');
</script>

<DropdownMenuPrimitive.Item
	{...rest}
	data-slot="dropdown-menu-item"
	data-inset={inset || undefined}
	class={cn(menu({ variant }).item(), classProp)}
/>
