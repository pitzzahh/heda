<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils/index.js';
	import { getCommandDialogState } from './context.js';

	let { children, class: classProp }: { children?: Snippet; class?: string } = $props();

	const dialogState = getCommandDialogState();

	// Rendered by CommandDialog in the rim above the card, so nothing is emitted here.
	$effect(() => {
		if (!dialogState) return;
		dialogState.header = { children, class: classProp };
		return () => {
			dialogState.header = undefined;
		};
	});
</script>

{#if !dialogState}
	<div
		data-slot="command-header"
		class={cn('flex items-center justify-between gap-3 px-3.5 pt-2.5 pb-1.5', classProp)}
	>
		<p class="text-foreground text-sm font-medium">{@render children?.()}</p>
	</div>
{/if}
