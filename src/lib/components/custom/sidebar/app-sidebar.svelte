<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import File from 'lucide-svelte/icons/file';
	import Folder from 'lucide-svelte/icons/folder';
	import type { ComponentProps } from 'svelte';
	import { SidebarHeader, AddPanelAndViewTrigger } from '.';
	import type { Panel } from '@/types/panel';
	import type { Load } from '@/types/load';
	import { getProjectState } from '@/hooks/project.svelte';
	import Button from '@/components/ui/button/button.svelte';
	import { PlusIcon } from 'lucide-svelte';
	import type { DialogState } from '@/state/types';
	import { getState } from '@/state/index.svelte';
	import { DIALOG_STATE_CTX } from '@/state/constants';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';

	let {
		ref = $bindable(null),
		tree,
		generic_phase_panel_form,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		tree: Panel[];
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
	} = $props();

	// let localStorage = new LocalStorage<ProjectProps>('project');
	let projectState = getProjectState();
	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);

	$inspect(projectState.project);

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
					{:else}
						<div class="grid h-[85vh] place-content-center">
							<div class="grid gap-2">
								<div class="text-center">
									<p class="text-lg font-bold text-muted-foreground">There is no project yet.</p>
									<p class="text-sm text-muted-foreground">Create a new project to get started.</p>
								</div>

								<!-- OPENS THE HIGHEST UNIT FORM IF THERE'S NO EXISTING PROJECT -->
								<Button
									size="sm"
									onclick={() => (dialogs_state.highestUnit = true)}
									href="/workspace?new_file=true"
								>
									<PlusIcon className="size-4 ml-3" /> Create a project
								</Button>
							</div>
						</div>
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
		<Sidebar.MenuItem>
			<Collapsible.Root
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
			>
				<Sidebar.MenuButton
					class="hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-primary/20"
				>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<ChevronRight class="transition-transform" {...props} />
						{/snippet}
					</Collapsible.Trigger>
					{@const item_name =
						(isPanel(item) && item.name) || (!isPanel(item) && item.load_description) || item}
					<AddPanelAndViewTrigger id={item_name as string} {generic_phase_panel_form}>
						<Folder class="size-4" />
						{item_name}
					</AddPanelAndViewTrigger>
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
	{/if}
{/snippet}
