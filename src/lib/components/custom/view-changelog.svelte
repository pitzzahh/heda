<script lang="ts">
	import DOMPurify from 'dompurify';
	import Markdown from 'svelte-exmarkdown';
	import { buttonVariants } from '@/components/ui/button';
	import * as Sheet from '@/components/ui/sheet/index.js';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import { History, CloudAlert } from '@/assets/icons';
	import { Skeleton } from '@/components/ui/skeleton//index.js';
	import { cn } from '@/utils';
	import * as Alert from '@/components/ui/alert/index.js';
	import { IsMounted } from 'runed';

	const isMounted = new IsMounted();

	let has_connection = $derived(isMounted && navigator && navigator.onLine);
</script>

<Sheet.Root>
	<Sheet.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
		<History />
		View Changelog
	</Sheet.Trigger>
	<Sheet.Content class="min-w-[55%]">
		<Sheet.Header>
			{#if !has_connection}
				<Alert.Root variant="destructive" class="w-full">
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
				<ScrollArea class="prose mt-2 h-[90%] max-w-none dark:prose-invert">
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
