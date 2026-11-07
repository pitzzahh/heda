<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { menu } from '#lib/components/ui/shared/menu.js';

	let {
		children,
		class: classProp,
		...rest
	}: { children?: Snippet; class?: string } & HTMLAttributes<HTMLElement> = $props();
</script>

<kbd {...rest} data-slot="context-menu-shortcut" class={cn(menu().shortcut(), classProp)}>
	{@render children?.()}
</kbd>
