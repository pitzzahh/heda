<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';
	import { type MenuSize, menu } from '#lib/components/ui/shared/menu';
	import { ANCHORED } from '#lib/components/ui/shared/anchor';

	let {
		class: classProp,
		size = 'default',
		...rest
	}: DropdownMenuPrimitive.SubContentProps & { size?: MenuSize } = $props();
</script>

<DropdownMenuPrimitive.Portal>
	<DropdownMenuPrimitive.SubContent
		{...rest}
		data-slot="dropdown-menu-sub-content"
		data-size={size}
		class={cn(ANCHORED, 'static min-w-40', menu({ size }).surface(), classProp)}
	/>
</DropdownMenuPrimitive.Portal>
