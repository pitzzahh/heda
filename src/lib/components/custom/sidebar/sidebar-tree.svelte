<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { cn } from '@/utils';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { DatabaseZap, PlugZap, PanelsLeftBottom } from 'lucide-svelte';
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
	import { page } from '$app/stores';
	import UpdatePanelDialog from './update-panel-dialog.svelte';

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
	let open_context_menu = $state(false);
	let params_node_id = $derived($page.params.id.split('_').at(-1) || '');
	function toggle() {
		collapsible_state = !collapsible_state;
	}
</script>

{#await getChildNodesByParentId(node.id)}
	<p></p>
{:then children}
	{#if node.node_type === 'load'}
		<Sidebar.MenuButton
			class="flex w-full items-center justify-between hover:bg-primary/20 data-[active=true]:bg-transparent"
		>
			<ContextMenu.Root>
				<ContextMenu.Trigger class="w-full">
					<div class="flex w-full items-center gap-2">
						<div class="w-4">
							<PlugZap class="size-4" />
						</div>

						<span class="truncate">
							{typeof node === 'string' ? node : node.load_data?.load_description}
						</span>
					</div>
				</ContextMenu.Trigger>
				<ContextMenu.Content>
					{#snippet children()}
						<ConfirmationDialog
							trigger_text="Remove load"
							trigger_variant="destructive"
							bind:some_open_state={open_context_menu}
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
						'-translate-x-2': node.node_type === 'panel',
						'bg-primary/20': params_node_id === node.id
					})}
				>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<ChevronRight class="transition-transform" {...props} />
						{/snippet}
					</Collapsible.Trigger>
					<ContextMenu.Root bind:open={open_context_menu}>
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
									<div class="w-4">
										<DatabaseZap class="size-4" />
									</div>
								{:else if node.node_type === 'panel'}
									<div class="w-4"><PanelsLeftBottom class="size-4" /></div>
								{/if}

								<span class="truncate">
									{node_name}
								</span>
							</AddPanelAndViewTrigger>
						</ContextMenu.Trigger>

						<ContextMenu.Content class="grid gap-1">
							{#snippet children()}
								{#if node.node_type === 'panel' && node.parent_id}
									<UpdatePanelDialog
										panel_to_edit={node}
										{generic_phase_panel_form}
										{highest_unit}
										bind:some_open_state={open_context_menu}
										parent_id={node.parent_id}
									/>
								{/if}

								<ConfirmationDialog
									trigger_text={node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}
									trigger_variant="destructive"
									bind:some_open_state={open_context_menu}
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
