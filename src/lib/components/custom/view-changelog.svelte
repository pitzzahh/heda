<script lang="ts">
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';
	import { buttonVariants } from '@/components/ui/button';
	import * as Drawer from '@/components/ui/drawer/index.js';
	import { History } from '@/assets/icons';
</script>

<Drawer.Root>
	<Drawer.Trigger class={buttonVariants({ size: 'sm' })}>
		<History />
		View Changelog
	</Drawer.Trigger>
	<Drawer.Content class="max-h-96">
		<Drawer.Header>
			<Drawer.Title>Changelog</Drawer.Title>
			<Drawer.Description>This contains the changelog</Drawer.Description>
		</Drawer.Header>

		{#await fetch('https://raw.githubusercontent.com/pitzzahh/heda/refs/heads/main/changelog.md')}
			<p>Loading...</p>
		{:then raw_changelog}
			{#await raw_changelog.text()}
				<p>Loading...</p>
			{:then response_body}
				{#await marked(response_body)}
					<p>Loading...</p>
				{:then changelog}
					<div class="p-2">
						{@html DOMPurify.sanitize(changelog)}
					</div>
				{:catch error}
					<p>{error.message}</p>
				{/await}
			{:catch error}
				<p>{error.message}</p>
			{/await}
		{:catch error}
			<p>{error.message}</p>
		{/await}
	</Drawer.Content>
</Drawer.Root>
