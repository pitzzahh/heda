<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import File from 'lucide-svelte/icons/file';
	import Folder from 'lucide-svelte/icons/folder';
	import type { ComponentProps } from 'svelte';
	import { SidebarHeader } from '.';
	import { LocalStorage } from '@/hooks/storage.svelte';
	import type { Panel } from '@/types/panel';
	import SidebarItemContextMenu from './sidebar-item-context-menu.svelte';

	interface ProjectProps {
		highest_unit_form: any;
		tree: Panel[];
	}

	let localStorage = new LocalStorage<ProjectProps>('project');

	// Props for Sidebar component
	let {
		ref = $bindable(null),
		tree,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		tree: Panel[];
	} = $props();

	$effect(() => {
		localStorage.current = {
			...localStorage.current,
			tree
		};
	});
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
						item: localStorage.current.highest_unit_form.distribution_unit,
						children: localStorage.current.tree,
						isRootNode: !!localStorage.current.highest_unit_form.distribution_unit
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
	item: Panel;
	children: Panel[];
	isRootNode?: boolean;
})}
	{#if children.length === 0 && !isRootNode}
		<Sidebar.MenuButton class="data-[active=true]:bg-transparent">
			<File />
			<span>{item.name || item}</span>
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
								<span>{item.name || item}</span>
							</Sidebar.MenuButton>
						</SidebarItemContextMenu>
					{/snippet}
				</Collapsible.Trigger>

				<Collapsible.Content>
					<Sidebar.MenuSub>
						{#each children as child, index (index)}
							{@render Tree({ item: child, children: children || [] })}
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{/snippet}
