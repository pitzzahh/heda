<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { table } from './variants.js';
	import { getTableStyle } from './context.js';

	let {
		children,
		class: className,
		...rest
	}: { children?: Snippet } & HTMLAttributes<HTMLTableSectionElement> = $props();

	const style = getTableStyle();
	const classes = $derived(table(style()));
</script>

<tbody data-slot="table-body" class={cn(classes.body(), className)} {...rest}>
	{@render children?.()}
</tbody>
