<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { table } from './variants.js';
	import { getTableStyle } from './context.js';

	let {
		ref = $bindable(null),
		children,
		class: className,
		...rest
	}: {
		ref?: HTMLTableRowElement | null;
		children?: Snippet;
	} & HTMLAttributes<HTMLTableRowElement> = $props();

	const style = getTableStyle();
	const classes = $derived(table(style()));
</script>

<tr bind:this={ref} data-slot="table-row" class={cn(classes.row(), className)} {...rest}>
	{@render children?.()}
</tr>
