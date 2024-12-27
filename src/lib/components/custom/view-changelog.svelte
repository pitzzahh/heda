<script lang="ts">
	import DOMPurify from 'dompurify';
	import Markdown from 'svelte-exmarkdown';
	import { marked } from 'marked';
	import { buttonVariants } from '@/components/ui/button';
	import * as Sheet from '@/components/ui/sheet/index.js';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import { History } from '@/assets/icons';
</script>

<Sheet.Root>
	<Sheet.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>
		<History />
		View Changelog
	</Sheet.Trigger>
	<Sheet.Content class="min-w-[55%]">
		<Sheet.Header>
			<Sheet.Title>Changelog</Sheet.Title>
			<Sheet.Description>This contains the changelog</Sheet.Description>
		</Sheet.Header>

		{#await fetch('https://raw.githubusercontent.com/pitzzahh/heda/refs/heads/main/changelog.md')}
			<p>Loading...</p>
		{:then raw_changelog}
			{#await raw_changelog.text()}
				<p>Loading...</p>
			{:then response_body}
				<ScrollArea class="mt-2 h-[90%]">
					{@html marked(DOMPurify.sanitize(response_body))}
				</ScrollArea>
			{:catch error}
				<p>{error.message}</p>
			{/await}
		{:catch error}
			<p>{error.message}</p>
		{/await}
	</Sheet.Content>
</Sheet.Root>
