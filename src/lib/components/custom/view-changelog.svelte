<script lang="ts">
	import DOMPurify from 'dompurify';
	import Markdown from 'svelte-exmarkdown';
	// import { marked } from 'marked';
	import { buttonVariants } from '@/components/ui/button';
	import * as Sheet from '@/components/ui/sheet/index.js';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import { History } from '@/assets/icons';
	import Skeleton from '../ui/skeleton/skeleton.svelte';
	import { cn } from '@/utils';
	import CircleAlert from 'lucide-svelte/icons/circle-alert';
	import { CloudAlert } from 'lucide-svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';

	let has_connection = $state(false);

	$effect(() => {
		const interval = setInterval(() => {
			fetch('https://raw.githubusercontent.com', { method: 'HEAD', mode: 'no-cors' })
				.then(() => (has_connection = true))
				.catch(() => (has_connection = false));
		}, 2000);

		return () => {
			clearInterval(interval);
		};
	});
</script>

<Sheet.Root>
	<Sheet.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
		<History />
		View Changelog
	</Sheet.Trigger>
	<Sheet.Content class="min-w-[55%]">
		<Sheet.Header class="flex w-full flex-row items-center justify-between">
			<div>
				<Sheet.Title>Changelog</Sheet.Title>
				<Sheet.Description>This contains the changelog</Sheet.Description>
			</div>

			{#if !has_connection}
				<Alert.Root variant="destructive" class="mr-4 max-w-[350px] bg-red-600/5">
					<CloudAlert class="size-4" />
					<Alert.Title class="font-semibold">No Internet Connection</Alert.Title>
					<Alert.Description class="text-xs">
						Please connect to an internet to see the latest change logs.
					</Alert.Description>
				</Alert.Root>
			{/if}
		</Sheet.Header>
		{#await fetch('https://raw.githubusercontent.com/pitzzahh/heda/refs/heads/main/changelog.md')}
			{@render textSkeleton()}
		{:then raw_changelog}
			{#await raw_changelog.text()}
				{@render textSkeleton()}
			{:then response_body}
				<ScrollArea class="mt-2 h-[90%]">
					<!-- {@html marked(DOMPurify.sanitize(response_body))} -->
					<Markdown md={DOMPurify.sanitize(response_body)} />
				</ScrollArea>
			{:catch error}
				{@render errorIndicator()}
			{/await}
		{:catch error}
			{@render errorIndicator()}
		{/await}
	</Sheet.Content>
</Sheet.Root>

{#snippet textSkeleton()}
	<div class="flex flex-col gap-3">
		{#each [...Array(30)] as _, i (i)}
			<Skeleton
				class={cn('h-4 w-[30%]', {
					'w-[60%]': i % 5 === 0,
					'w-[50%]': i % 3 === 0,
					'w-[40%]': i % 2 === 0
				})}
			/>
		{/each}
	</div>
{/snippet}

{#snippet errorIndicator()}
	<div class="grid size-full place-content-center">
		<div class="grid place-items-center gap-1 text-muted-foreground opacity-80">
			<CloudAlert class="size-[90px]" />
			<p class="font-semibold">An error occured, please try again.</p>
		</div>
	</div>
{/snippet}
