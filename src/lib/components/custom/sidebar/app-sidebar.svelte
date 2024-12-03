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
	import type { Load } from '@/types/load';
	import { getProjectState } from '@/hooks/project.svelte';

	interface ProjectProps {
		highest_unit_form: any;
		tree: Panel[];
	}

	// let localStorage = new LocalStorage<ProjectProps>('project');
	let projectState = getProjectState();

	console.log(projectState.project);

	let {
		ref = $bindable(null),
		tree,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		tree: Panel[];
	} = $props();

	// this causes the re-renders
	// $effect(() => {
	// 	localStorage.current = {
	// 		...localStorage.current,
	// 		tree
	// 	};
	// });

	function isPanel(item: Panel | Load): item is Panel {
		return (item as Panel).name !== undefined;
	}
</script>

<Sidebar.Root bind:ref {...restProps}>
	<SidebarHeader />
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Distribution Unit</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if projectState.project?.highest_unit_form}
						{@render Tree({
							item: projectState.project?.highest_unit_form.distribution_unit,
							children: projectState.project.tree,
							isRootNode: !!projectState.project?.highest_unit_form.distribution_unit
						})}
					{/if}
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
	item: Panel | Load;
	children: Panel[] | Load[];
	isRootNode?: boolean;
})}
	{#if children.length === 0 && !isRootNode}
		<Sidebar.MenuButton class="data-[active=true]:bg-transparent">
			<File />
			<span>{isPanel(item) ? item.name : item.load_description}</span>
		</Sidebar.MenuButton>
	{:else}
		<SidebarItemContextMenu
			uri={`/workspace/${isPanel(item) ? 'panel' : 'load-schedule'}/${item.id}`}
		>
			<Sidebar.MenuItem>
				<Collapsible.Root
					class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
				>
					<Sidebar.MenuButton>
						<Collapsible.Trigger>
							{#snippet child({ props })}
								<ChevronRight class="transition-transform" {...props} />
							{/snippet}
						</Collapsible.Trigger>
						<Folder />
						<span
							>{(isPanel(item) && item.name) ||
								(!isPanel(item) && item.load_description) ||
								item}</span
						>
					</Sidebar.MenuButton>

					<Collapsible.Content class="w-full">
						<Sidebar.MenuSub class="w-full">
							{#each children as child, index (index)}
								{@render Tree({ item: child, children: child.loads || [] })}
							{/each}
						</Sidebar.MenuSub>
					</Collapsible.Content>
				</Collapsible.Root>
			</Sidebar.MenuItem>
		</SidebarItemContextMenu>
	{/if}
{/snippet}
