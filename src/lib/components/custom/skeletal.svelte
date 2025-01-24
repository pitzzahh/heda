<script lang="ts">
	import { Skeleton } from '@/components/ui/skeleton';
	import type { Snippet } from 'svelte';
	let {
		children,
		options_count = Math.floor(Math.random() * (10 - 5 + 1)) + 5
	}: {
		children?: Snippet;
		options_count?: number;
	} = $props();
</script>

<div class="mt-2 flex flex-col gap-2">
	<div class="flex items-center justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<Skeleton class="h-9 w-72 rounded-md" />
			{#each Array(options_count) as _}
				<Skeleton class="h-8 w-[6.5rem] rounded-md" />
			{/each}
		</div>
		<Skeleton class="h-9 w-[6.5rem] rounded-md md:w-20" />
	</div>
	{@render children?.()}
	{#if !children}
		<div class="flex flex-col items-center justify-center gap-1">
			{#each Array(15) as _}
				<Skeleton class="h-9 w-full rounded-md" />
			{/each}
		</div>

		<div class="flex items-center justify-between gap-2">
			<div class="text-muted-foreground flex-1 text-sm">
				<Skeleton class="h-9 w-32 rounded-md" />
			</div>
		</div>
	{/if}
</div>