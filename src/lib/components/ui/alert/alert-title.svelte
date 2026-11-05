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
	data-slot="alert-title"
	class={cn('text-foreground col-start-2 min-h-4 font-medium tracking-tight', classProp)}
>
	{@render children?.()}
</div>
