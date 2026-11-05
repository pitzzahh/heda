<script lang="ts">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';
	import { ANCHORED } from '#lib/components/ui/shared/anchor';

	let {
		class: classProp,
		side = 'top',
		sideOffset = 6,
		...rest
	}: TooltipPrimitive.ContentProps = $props();
</script>

<TooltipPrimitive.Portal>
	<TooltipPrimitive.Content
		{side}
		{sideOffset}
		{...rest}
		data-slot="tooltip-content"
		class={cn(
			ANCHORED,
			'bg-foreground text-background static z-50 rounded-md px-2 py-1 text-xs shadow-[var(--overlay-shadow)]',
			'data-[state=open]:pointer-events-none',
			// Tooltips report delayed-open/instant-open, never open. The delayed one fades in;
			// an instant one carries no animation and pops, so rapid hovers skip motion.
			'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=delayed-open]:duration-[var(--duration-tooltip)]',
			classProp
		)}
	/>
</TooltipPrimitive.Portal>
