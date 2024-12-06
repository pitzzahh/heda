<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { ComponentProps } from 'svelte';
	import { SidebarHeader } from '.';
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
	import type { Project } from '@/types/project';
	import type { Node } from '@/types/project';
	import SidebarTree from './sidebar-tree.svelte';

	let {
		ref = $bindable(null),
		tree,
		generic_phase_panel_form,
		project,
		nodes,
		...restProps
	}: ComponentProps<typeof Sidebar.Root> & {
		tree: Panel[];
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
		project?: Project;
		nodes: Node[];
	} = $props();

	// let localStorage = new LocalStorage<ProjectProps>('project');
	let projectState = getProjectState();
	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);

	$inspect(projectState.project);

	console.log(nodes);

	function isPanel(node: Panel | Load): node is Panel {
		return (node as Panel).name !== undefined;
	}
</script>

<Sidebar.Root bind:ref {...restProps}>
	<SidebarHeader />
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Distribution Unit</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#if project?.highest_unit_form}
						<SidebarTree
							project_id={project.id}
							node={project?.highest_unit_form.distribution_unit}
							isRootNode={!!project?.highest_unit_form.distribution_unit}
							highest_unit={project.highest_unit_form}
							{generic_phase_panel_form}
						/>
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

<!-- {#snippet Tree({
	node,
	children = [],
	isRootNode
}: {
	node: Node | string;
	children: Node[];
	isRootNode?: boolean;
})}
	{#if children.length === 0 && !isRootNode && typeof node !== 'string' && node.node_type === 'load'}
		<Sidebar.MenuButton class="data-[active=true]:bg-transparent">
			<File />
			<span>{typeof node === 'string' ? node : node.load_data?.load_description}</span>
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
					{@const node_name =
						(isPanel(node) && node.name) || (!isPanel(node) && node.load_description) || node}
					<AddPanelAndViewTrigger id={node_name as string} {generic_phase_panel_form}>
						<Folder class="size-4" />
						{node_name}
					</AddPanelAndViewTrigger>
				</Sidebar.MenuButton>

				<Collapsible.Content class="w-full">
					<Sidebar.MenuSub class="w-full">
						{#each children as child, index (index)}
							{@render Tree({ node: child, children: child.loads || [] })}
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{/snippet} -->
