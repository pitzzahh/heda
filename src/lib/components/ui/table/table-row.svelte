<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils';
	import { table } from './variants';
	import { getTableStyle } from './context';

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
