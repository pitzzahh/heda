<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLiAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils';
	import { breadcrumbStyles } from './context';

	let {
		children,
		class: classProp,
		...rest
	}: { children?: Snippet; class?: string } & HTMLLiAttributes = $props();

	const s = $derived(breadcrumbStyles());
</script>

<li {...rest} data-slot="breadcrumb-item" class={cn(s.item(), classProp)}>
	{@render children?.()}
</li>
