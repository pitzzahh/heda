<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils';

	let {
		children,
		class: classProp,
		...rest
	}: { children?: Snippet; class?: string } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	{...rest}
	data-slot="dropdown-menu-label"
	class={cn('text-muted-foreground px-2.5 py-1.5 text-xs font-medium', classProp)}
>
	{@render children?.()}
</div>
