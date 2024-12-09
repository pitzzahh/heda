<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { cn } from '@/utils';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { File, Folder } from 'lucide-svelte';
	import ChevronRight from 'lucide-svelte/icons/chevron-right';
	import { ConfirmationDialog } from '@/components/custom';
	import type { Node, Project } from '@/types/project';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import { SidebarTree, AddPanelAndViewTrigger } from '.';
	import { getChildNodesByParentId } from '@/db/queries/index';
	import { deleteProject, removeNode } from '@/db/mutations';
	import { invalidateAll } from '$app/navigation';
	import type { HighestUnitSchema } from '@/schema';

	let {
		node,
		highest_unit,
		generic_phase_panel_form,
		project
	}: {
		node: Node;
		highest_unit: HighestUnitSchema;
		project?: Project;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
	} = $props();

	//TODO: FIX the collapsible to not close when a panel is added
	let collapsible_state = $state(false);

	function toggle() {
		collapsible_state = !collapsible_state;
	}
</script>

{#await getChildNodesByParentId(node.id)}
	<p></p>
{:then children}
	{#if node.node_type === 'load'}
		<Sidebar.MenuButton
			class=" flex w-full items-center justify-between hover:bg-primary/20 data-[active=true]:bg-transparent"
		>
			<ContextMenu.Root>
				<ContextMenu.Trigger class="w-full">
					<div class="flex w-full items-center gap-2">
						<File class="size-4" />
						<span>{typeof node === 'string' ? node : node.load_data?.load_description}</span>
					</div>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					{#snippet children()}
						<ConfirmationDialog
							trigger_text="Remove load"
							trigger_variant="destructive"
							onConfirm={async () => {
								await removeNode(node.id);
								await invalidateAll();
							}}
						/>
					{/snippet}
				</ContextMenu.Content>
			</ContextMenu.Root>
		</Sidebar.MenuButton>
	{:else}
		<Sidebar.MenuItem>
			<Collapsible.Root
				open
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
			>
				<Sidebar.MenuButton
					class={cn('hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-primary/20', {
						'-translate-x-2': node.node_type === 'panel'
					})}
				>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<ChevronRight class="transition-transform" {...props} />
						{/snippet}
					</Collapsible.Trigger>
					<ContextMenu.Root>
						<ContextMenu.Trigger class="w-full">
							{@const node_name = (node.highest_unit_form?.distribution_unit ||
								node.panel_data?.name) as string}
							<AddPanelAndViewTrigger
								id={node.id}
								panel_name={node_name}
								{generic_phase_panel_form}
								{highest_unit}
								is_parent_root_node={node.node_type === 'root'}
								parent_id={node.id}
							>
								<!-- TODO: Palitan or retain this -->
								{#if node.node_type === 'root'}
									<Folder class="size-4" />
								{/if}
								{node_name}
							</AddPanelAndViewTrigger>
						</ContextMenu.Trigger>

						<ContextMenu.Content>
							{#snippet children()}
								<ConfirmationDialog
									trigger_text={node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}
									trigger_variant="destructive"
									onConfirm={async () => {
										if (node.node_type === 'root' && project) {
											await deleteProject(project.id);
										} else await removeNode(node.id);

										await invalidateAll();
									}}
								/>
							{/snippet}
						</ContextMenu.Content>
					</ContextMenu.Root>
				</Sidebar.MenuButton>

				<Collapsible.Content class="w-full">
					<Sidebar.MenuSub class="w-full">
						{#each children as unknown as Node[] as child, index (index)}
							<SidebarTree node={child} {generic_phase_panel_form} {highest_unit} />
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{:catch error}
	<p style="color: red">{error.message}</p>
{/await}
