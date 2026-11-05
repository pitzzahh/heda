<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';
	import { type MenuSize, menu } from '#lib/components/ui/shared/menu';
	import { ANCHORED } from '#lib/components/ui/shared/anchor';
	import { dropdownMenuTrigger } from './context';

	let {
		class: classProp,
		sideOffset = 4,
		align = 'start',
		size = 'default',
		ref = $bindable(null),
		...rest
	}: DropdownMenuPrimitive.ContentProps & { size?: MenuSize } = $props();
</script>

<DropdownMenuPrimitive.Portal>
	<DropdownMenuPrimitive.Content
		bind:ref
		{sideOffset}
		{align}
		aria-labelledby={dropdownMenuTrigger()}
		{...rest}
		data-slot="dropdown-menu-content"
		data-size={size}
		class={cn(ANCHORED, 'static', menu({ size }).surface(), classProp)}
	/>
</DropdownMenuPrimitive.Portal>
