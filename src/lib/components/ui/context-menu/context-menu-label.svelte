<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils';

	let {
		children,
		class: classProp,
		inset = false,
		...rest
	}: {
		children?: Snippet;
		class?: string;
		inset?: boolean;
	} & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div
	{...rest}
	data-slot="context-menu-label"
	data-inset={inset || undefined}
	class={cn('text-muted-foreground px-2.5 py-1.5 text-xs font-medium data-[inset]:pl-8', classProp)}
>
	{@render children?.()}
</div>
