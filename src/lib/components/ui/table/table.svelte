<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { type TableDensity, type TableVariant, table } from './variants.js';
	import { setTableStyle } from './context.js';

	let {
		ref = $bindable(null),
		children,
		class: className,
		containerClass,
		variant = 'default',
		density = 'comfortable',
		...rest
	}: {
		/** Bindable: the `<table>` element. */
		ref?: HTMLTableElement | null;
		children?: Snippet;
		class?: string;
		containerClass?: string;
		variant?: TableVariant;
		density?: TableDensity;
	} & HTMLAttributes<HTMLTableElement> = $props();

	setTableStyle(() => ({ variant, density }));

	const classes = $derived(table({ variant, density }));
</script>

<div data-slot="table-container" class={cn(classes.container(), containerClass)}>
	<table bind:this={ref} data-slot="table" class={cn(classes.root(), className)} {...rest}>
		{@render children?.()}
	</table>
</div>
