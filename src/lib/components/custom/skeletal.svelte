<script lang="ts" module>
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
		options_count?: number;
	}
</script>

<script lang="ts">
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';

	let { children, options_count = Math.floor(Math.random() * (10 - 5 + 1)) + 5 }: Props = $props();
</script>

<div class="mt-2 flex flex-col gap-2">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<Skeleton class="h-9 w-72 rounded-md" />
			{#each Array(options_count).keys() as i (i)}
				<Skeleton class="h-8 w-26 rounded-md" />
			{/each}
		</div>
		<Skeleton class="h-9 w-26 rounded-md md:w-20" />
	</div>
	{@render children?.()}
	{#if !children}
		<div class="flex flex-col items-center justify-center gap-1">
			{#each Array(15).keys() as i (i)}
				<Skeleton class="h-9 w-full rounded-md" />
			{/each}
		</div>

		<div class="flex items-center justify-between gap-2">
			<div class="flex-1 text-sm text-muted-foreground">
				<Skeleton class="h-9 w-32 rounded-md" />
			</div>
		</div>
	{/if}
</div>
