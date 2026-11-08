<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLOlAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { breadcrumbStyles } from './context.js';

	let {
		children,
		class: classProp,
		...rest
	}: { children?: Snippet; class?: string } & HTMLOlAttributes = $props();

	const s = $derived(breadcrumbStyles());
</script>

<ol {...rest} data-slot="breadcrumb-list" class={cn(s.list(), classProp)}>
	{@render children?.()}
</ol>
