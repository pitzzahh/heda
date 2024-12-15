<script lang="ts">
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { cn } from '@/utils';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import {
		ChevronRight,
		Pencil,
		CirclePlus,
		DatabaseZap,
		PlugZap,
		PanelsLeftBottom,
		Grid2x2Plus,
		Trash2,
		Copy
	} from '@/assets/icons';
	import { ConfirmationDialog } from '@/components/custom';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import { SidebarTree, AddPanelAndViewTrigger } from '.';
	import { getChildNodesByParentId } from '@/db/queries/index';
	import { deleteProject, removeNode } from '@/db/mutations';
	import { goto, invalidateAll } from '$app/navigation';
	import type { Node, Project } from '@/db/schema';
	import { page } from '$app/stores';
	import { UpdatePanelDialog, UpdateLoadDialog } from '.';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';
	import { AddLoadDialog } from '../load';

	let {
		node,
		highest_unit,
		generic_phase_panel_form,
		phase_main_load_form,
		project
	}: {
		node: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		project?: Project;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
		phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>;
	} = $props();

	let open_panel_context_menu = $state(false);
	let open_load_context_menu = $state(false);
	let open_tree_edit_action_dialog = $state(false);
	let open_tree_add_panel_dialog = $state(false);
	let open_tree_add_load_dialog = $state(false);
	let open_tree_copy_load_dialog = $state(false);
	let open_tree_delete_dialog = $state(false);
	let params = $derived($page.params);
	let is_hovering_on_tree_item = $state(false);
</script>

{#await getChildNodesByParentId(node.id)}
	<Sidebar.MenuButton
		class="flex w-full items-center justify-between hover:bg-primary/20 data-[active=true]:bg-transparent"
	>
		{#snippet children()}
			<Skeleton class="h-6 w-full" />
		{/snippet}
	</Sidebar.MenuButton>
{:then child_nodes}
	{#if node.node_type === 'load'}
		<Sidebar.MenuButton
			onmouseenter={() => (is_hovering_on_tree_item = true)}
			onmouseleave={() => (is_hovering_on_tree_item = false)}
			class="flex w-full items-center hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-transparent"
		>
			<ContextMenu.Root bind:open={open_load_context_menu}>
				<ContextMenu.Trigger class="flex w-full items-center gap-1">
					<div class="flex w-full items-center gap-2">
						<div class="w-4">
							<PlugZap class="size-4" />
						</div>
						<span class="truncate">
							{typeof node === 'string' ? node : node.load_data?.load_description}
						</span>
					</div>
				</ContextMenu.Trigger>
				<ContextMenu.Content class="grid gap-1">
					{#snippet children()}
						<UpdateLoadDialog
							{highest_unit}
							{phase_main_load_form}
							bind:some_open_state={open_load_context_menu}
							load_to_edit={node}
						/>
						<ConfirmationDialog
							trigger_text="Remove load"
							trigger_variant="destructive"
							bind:some_open_state={open_load_context_menu}
							onConfirm={async () => {
								await removeNode(node.id);
								await invalidateAll();
							}}
						/>
					{/snippet}
				</ContextMenu.Content>
			</ContextMenu.Root>
			<div
				class={cn('hidden items-center gap-1.5', {
					flex: is_hovering_on_tree_item
				})}
			>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger
							class={buttonVariants({ variant: 'outline', size: 'icon' })}
							onclick={() => (open_tree_copy_load_dialog = true)}
						>
							<Copy />
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Copy Load</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger
							class={buttonVariants({ variant: 'ghost', size: 'icon', className: 'z-50' })}
							onclick={() => (open_tree_edit_action_dialog = true)}
						>
							<Pencil />
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Edit load</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger
							class={buttonVariants({ variant: 'destructive', size: 'icon' })}
							onclick={() => (open_tree_delete_dialog = true)}
						>
							<Trash2 />
						</Tooltip.Trigger>
						<Tooltip.Content>
							<p>Remove Panel</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		</Sidebar.MenuButton>
	{:else}
		<Sidebar.MenuItem class="w-full">
			<Collapsible.Root
				open
				class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
			>
				<Sidebar.MenuButton
					onmouseenter={() => (is_hovering_on_tree_item = true)}
					onmouseleave={() => (is_hovering_on_tree_item = false)}
					class={cn(
						'flex w-full items-center  hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-primary/20',
						{
							'bg-primary/20': params.id && params.id.split('_').at(-1) === node.id
						}
					)}
				>
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<ChevronRight class="transition-transform" {...props} />
						{/snippet}
					</Collapsible.Trigger>
					<ContextMenu.Root bind:open={open_panel_context_menu}>
						<ContextMenu.Trigger class="flex w-full items-center ">
							{@const node_name = (node.highest_unit_form?.distribution_unit ||
								node.panel_data?.name) as string}
							<AddPanelAndViewTrigger
								id={node.id}
								panel_name={node_name}
								{generic_phase_panel_form}
								{highest_unit}
								is_parent_root_node={node.node_type === 'root'}
								parent_id={node.id}
								latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
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
										bind:some_open_state={open_panel_context_menu}
										parent_id={node.parent_id}
									/>
								{/if}

								<ConfirmationDialog
									show_trigger={true}
									trigger_text={node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}
									trigger_variant="destructive"
									bind:some_open_state={open_panel_context_menu}
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
					<div
						class={cn('hidden w-fit items-center gap-1.5 py-1', {
							flex: is_hovering_on_tree_item
						})}
					>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger
									class={buttonVariants({ variant: 'ghost', size: 'icon' })}
									onclick={() => (open_tree_add_panel_dialog = true)}
								>
									<Grid2x2Plus />
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>Add Panel</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger
									class={buttonVariants({ variant: 'ghost', size: 'icon' })}
									onclick={() => (open_tree_add_load_dialog = true)}
								>
									<CirclePlus />
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>Add Load</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger
									class={buttonVariants({ variant: 'destructive', size: 'icon' })}
									onclick={() => (open_tree_delete_dialog = true)}
								>
									<Trash2 />
								</Tooltip.Trigger>
								<Tooltip.Content>
									<p>{node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</div>
					{@const node_name = (node.highest_unit_form?.distribution_unit ||
						node.panel_data?.name) as string}
					<AddPanelAndViewTrigger
						id={node.id}
						panel_name={node_name}
						{generic_phase_panel_form}
						{highest_unit}
						is_parent_root_node={node.node_type === 'root'}
						parent_id={node.id}
						bind:open_dialog_state={open_tree_add_panel_dialog}
						latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
					/>
					<AddLoadDialog
						{phase_main_load_form}
						{highest_unit}
						remove_trigger={true}
						bind:open_dialog_state={open_tree_add_load_dialog}
						latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
					/>
				</Sidebar.MenuButton>

				<Collapsible.Content class="w-full">
					<Sidebar.MenuSub class="w-full">
						{#each child_nodes as child, index (index)}
							<SidebarTree
								node={child}
								{generic_phase_panel_form}
								{phase_main_load_form}
								{highest_unit}
							/>
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>
		</Sidebar.MenuItem>
	{/if}
{:catch error}
	<!-- TODO: Enhance error page -->
	<p style="color: red">{error.message}</p>
{/await}

<UpdateLoadDialog
	{highest_unit}
	{phase_main_load_form}
	remove_trigger={true}
	bind:open_load_dialog={open_tree_edit_action_dialog}
	bind:some_open_state={open_load_context_menu}
	load_to_edit={node}
/>
<ConfirmationDialog
	trigger_text={node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}
	trigger_variant="destructive"
	bind:open_dialog_state={open_tree_delete_dialog}
	onConfirm={async () => {
		if (node.node_type === 'root' && project) {
			await deleteProject(project.id);
		} else await removeNode(node.id);
		await invalidateAll();
	}}
/>
