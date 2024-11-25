<script lang="ts" module>
	// This is sample data.
	const data = {
		changes: [
			{
				file: 'README.md',
				state: 'M'
			},
			{
				file: 'routes/+page.svelte',
				state: 'U'
			},
			{
				file: 'routes/+layout.svelte',
				state: 'M'
			}
		],
		tree: [
			['lib', ['components', 'button.svelte', 'card.svelte'], 'utils.ts'],
			[
				'routes',
				['hello', '+page.svelte', '+page.ts'],
				'+page.svelte',
				'+page.server.ts',
				'+layout.svelte'
			],
			['static', 'favicon.ico', 'svelte.svg'],
			'eslint.config.js',
			'.gitignore',
			'svelte.config.js',
			'tailwind.config.js',
			'package.json',
			'README.md'
		]
	};
</script>

<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import File from 'lucide-svelte/icons/file';
	import Folder from 'lucide-svelte/icons/folder';
	import type { ComponentProps } from 'svelte';
	import { SidebarHeader } from '.';
	import { LocalStorage } from '@/hooks/storage.svelte';
	import SidebarItemContextMenu from './sidebar-item-context-menu.svelte';

	let localStorage = new LocalStorage('project') as any;

	let localStorageData = $derived(
		localStorage.current || {
			highest_unit_form: null,
			panels: []
		}
	);

	$inspect(localStorage);

	// Props for Sidebar component
	let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();
</script>

<Sidebar.Root bind:ref {...restProps}>
	<SidebarHeader />
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Distribution Unit</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<!-- Render the root node for the highest unit -->
					{@render Tree({
						item: localStorageData.highest_unit_form.distribution_unit,
						children: localStorageData.panels,
						isRootNode: !!localStorageData.highest_unit_form.distribution_unit
					})}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
	<Sidebar.Rail />
</Sidebar.Root>

{#snippet Tree({
	item,
	children = [],
	isRootNode
}: {
	item: any;
	children: any[];
	isRootNode?: boolean;
})}
	{#if children.length === 0 && !isRootNode}
		<Sidebar.MenuButton class="data-[active=true]:bg-transparent">
			<File />
			<span>{item.description || item}</span>
		</Sidebar.MenuButton>
	{:else}
		<Sidebar.MenuItem>
			<Collapsible.Root
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
			>
				<Collapsible.Trigger>
					{#snippet child({ props })}
						<SidebarItemContextMenu>
							<Sidebar.MenuButton {...props}>
								<ChevronRight class="transition-transform" />
								<Folder />
								<span>{item.panel_name || item}</span>
							</Sidebar.MenuButton>
						</SidebarItemContextMenu>
					{/snippet}
				</Collapsible.Trigger>

				<Collapsible.Content>
					<Sidebar.MenuSub>
						{#each children as child, index (index)}
							{@render Tree({ item: child, children: child.loads || [] })}
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{/snippet}
