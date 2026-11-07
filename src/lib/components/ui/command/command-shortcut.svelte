<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '#lib/utils/index.js';
	import { getCommand } from './context.js';

	let {
		children,
		class: classProp,
		...rest
	}: { children?: Snippet; class?: string } & HTMLAttributes<HTMLSpanElement> = $props();
	const command = getCommand();
</script>

<span {...rest} data-slot="command-shortcut" class={cn(command.styles.shortcut(), classProp)}>
	{@render children?.()}
</span>
