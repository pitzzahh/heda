<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { focusGroupControl, type InputGroupAddonAlign, inputGroupAddon } from './variants.js';

	let {
		ref = $bindable(null),
		class: classProp,
		align = 'inline-start',
		onclick,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & {
		ref?: HTMLDivElement | null;
		align?: InputGroupAddonAlign;
	} = $props();
</script>

<!-- A pointer convenience: the control inside is focusable itself. -->
<div
	bind:this={ref}
	role="group"
	data-slot="input-group-addon"
	data-align={align}
	class={cn(inputGroupAddon({ align }), classProp)}
	onclick={(event) => {
		focusGroupControl(event.target, event.currentTarget);
		onclick?.(event);
	}}
	{...rest}
>
	{@render children?.()}
</div>
