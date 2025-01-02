<script lang="ts">
	import * as Collapsible from '@/components/ui/collapsible/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import * as Tooltip from '@/components/ui/tooltip/index.js';
	import { cn } from '@/utils';
	import { buttonVariants, type ButtonVariant } from '@/components/ui/button/index.js';
	import { Skeleton } from '@/components/ui/skeleton/index.js';
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';
	import * as ContextMenu from '@/components/ui/context-menu/index.js';
	import { ChevronRight, DatabaseZap, Ellipsis, PlugZap, PanelsLeftBottom } from '@/assets/icons';
	import { ConfirmationDialog } from '@/components/custom';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import { SidebarTree, AddPanelAndViewTrigger } from '.';
	import { getChildNodesByParentId } from '@/db/queries/index';
	import { copyAndAddNodeById, deleteProject, removeNode } from '@/db/mutations';
	import { invalidate } from '$app/navigation';
	import type { Node, Project } from '@/db/schema';
	import { page } from '$app/state';
	import { UpdatePanelDialog, UpdateLoadDialog } from '.';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';
	import { AddLoadDialog } from '../load';
	import { toast } from 'svelte-sonner';
	import { useSidebar } from '@/components/ui/sidebar/context.svelte';
	import {
		CirclePlusIcon,
		CopyIcon,
		Grid2x2PlusIcon,
		PencilIcon,
		Trash2Icon
	} from './(components)';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';

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

	const params = $derived(page.params);
	const sidebar_context = useSidebar();

	let open_panel_context_menu = $state(false);
	let open_load_context_menu = $state(false);
	let open_tree_edit_panel_action_dialog = $state(false);
	let open_tree_edit_load_action_dialog = $state(false);
	let open_tree_add_panel_dialog = $state(false);
	let open_tree_add_load_dialog = $state(false);
	let open_tree_delete_dialog = $state(false);
	let is_hovering_on_tree_item = $state(false);
	let button_state: 'stale' | 'processing' = $state('stale');
	let undo_redo_state = getUndoRedoState();
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
			{@const tooltip_data = [
				{
					trigger_callback: async () => {
						await copyAndAddNodeById(node.id)
						.then((copied_node) => {
								undo_redo_state.setActionToUndo({
									action: 'copy_node',
									data: copied_node as unknown as PhaseLoadSchedule
								});
								invalidate('app:workspace');
							})
							.finally(() => invalidate('app:workspace/load-schedule'));
					},
					variant: 'ghost',
					icon: CopyIcon,
					tooltip_content: 'Copy Load'
				},
				{
					trigger_callback: () => (open_tree_edit_load_action_dialog = true),
					variant: 'ghost',
					icon: PencilIcon,
					hidden: false,
					tooltip_content: `Edit ${node.load_data?.load_description || 'Load'}`
				},
				{
					trigger_callback: () => (open_tree_delete_dialog = true),
					variant: 'ghost',
					icon: Trash2Icon,
					hidden: false,
					tooltip_content: `Remove ${node.load_data?.load_description || 'Load'}`,
					className: 'hover:bg-destructive hover:text-white'
				}
			]}
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
								await removeNode(node.id)
									.then(() => invalidate('app:workspace'))
									.finally(() => invalidate('app:workspace/load-schedule'));
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
				{#each tooltip_data as { trigger_callback, variant, icon, hidden, tooltip_content, className }, i}
					{#if !hidden}
						<Tooltip.Provider>
							<Tooltip.Root>
								<Tooltip.Trigger
									class={buttonVariants({
										variant: variant as ButtonVariant,
										size: 'icon',
										className
									})}
									onclick={() => trigger_callback()}
								>
									{@render icon(i === tooltip_data.length - 1 ? 'text-inherit' : undefined)}
								</Tooltip.Trigger>
								<Tooltip.Content>
									{tooltip_content}
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					{/if}
				{/each}
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
						'relative hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-primary/20',
						{
							'bg-primary/20': params.id && params.id.split('_').at(-1) === node.id
						}
					)}
				>
					{@const tooltip_data = [
						{
							trigger_callback: () => (open_tree_add_panel_dialog = true),
							variant: 'ghost',
							icon: Grid2x2PlusIcon,
							hidden: false,
							tooltip_content: 'Add Panel'
						},
						{
							trigger_callback: () => (open_tree_add_load_dialog = true),
							variant: 'ghost',
							icon: CirclePlusIcon,
							hidden: false,
							tooltip_content: 'Add Load'
						},
						{
							trigger_callback: async () => {
								await copyAndAddNodeById(node.id)
									.then((copied_node) => {
										undo_redo_state.setActionToUndo({
											action: 'copy_node',
											data: copied_node as unknown as PhaseLoadSchedule
										});
										invalidate('app:workspace');
									})
									.finally(() => invalidate('app:workspace/load-schedule'));
							},
							variant: 'ghost',
							icon: CopyIcon,
							hidden: node.node_type === 'root',
							tooltip_content: 'Copy Panel'
						},
						{
							trigger_callback: () => {
								if (!node.parent_id) {
									// TODO: Log system error
									return toast.warning('Failed to identify the panel supplier', {
										description:
											'This is a system error and should not be here, the error has been logged.'
									});
								}
								open_tree_edit_panel_action_dialog = true;
							},
							variant: 'ghost',
							icon: PencilIcon,
							hidden: node.node_type === 'root',
							tooltip_content: `Edit ${node.panel_data?.name || 'Panel'}`
						},

						{
							trigger_callback: () => (open_tree_delete_dialog = true),
							variant: 'ghost',
							icon: Trash2Icon,
							hidden: false,
							tooltip_content: node.node_type === 'root' ? 'Remove Project' : 'Remove Panel',
							className: 'hover:bg-destructive hover:text-white'
						}
					]}
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<ChevronRight class="transition-transform" {...props} />
						{/snippet}
					</Collapsible.Trigger>
					<ContextMenu.Root bind:open={open_panel_context_menu}>
						<ContextMenu.Trigger class="flex w-full items-center justify-between">
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
										trigger_text={`Edit ${node.panel_data?.name || 'Panel'}`}
										show_trigger={true}
										bind:some_open_state={open_panel_context_menu}
										parent_id={node.parent_id}
									/>
								{/if}
								<ConfirmationDialog
									show_trigger={true}
									trigger_text={node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}
									trigger_variant="destructive"
									bind:button_state
									bind:some_open_state={open_panel_context_menu}
									onConfirm={async () => {
										if (node.node_type === 'root' && project) {
											await deleteProject(project.id);
										} else {
											const removed_node = await removeNode(node.id);
											undo_redo_state.setActionToUndo({
												data: node as PhaseLoadSchedule,
												action: 'delete_node',
												children_nodes: removed_node.children_nodes
											});
										}
										invalidate('app:workspace/load-schedule')
											.then(() => (button_state = 'stale'))
											.finally(() => {
												toast.success(
													node.node_type === 'root'
														? `${project?.project_name ?? 'Project'} removed succesfully`
														: `${node.panel_data?.name ?? 'Panel'} removed succesfully`
												);
											});
									}}
								/>
							{/snippet}
						</ContextMenu.Content>
					</ContextMenu.Root>
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

			{@const tooltip_data = [
				{
					trigger_callback: () => (open_tree_add_panel_dialog = true),
					variant: 'ghost',
					icon: Grid2x2PlusIcon,
					hidden: false,
					tooltip_content: 'Add Panel',
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: () => (open_tree_add_load_dialog = true),
					variant: 'ghost',
					icon: CirclePlusIcon,
					hidden: false,
					tooltip_content: 'Add Load',
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: async () => {
						await copyAndAddNodeById(node.id)
							.then(() => invalidate('app:workspace'))
							.finally(() => invalidate('app:workspace/load-schedule'));
					},
					variant: 'ghost',
					icon: CopyIcon,
					hidden: node.node_type === 'root',
					tooltip_content: 'Copy Panel',
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: () => {
						if (!node.parent_id) {
							// TODO: Log system error
							return toast.warning('Failed to identify the panel supplier', {
								description:
									'This is a system error and should not be here, the error has been logged.'
							});
						}
						open_tree_edit_panel_action_dialog = true;
					},
					variant: 'ghost',
					icon: PencilIcon,
					hidden: node.node_type === 'root',
					tooltip_content: `Edit ${node.panel_data?.name || 'Panel'}`,
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: () => (open_tree_delete_dialog = true),
					variant: 'ghost',
					icon: Trash2Icon,
					hidden: false,
					tooltip_content: node.node_type === 'root' ? 'Remove Project' : 'Remove Panel',
					className: 'hover:bg-destructive hover:text-white text-muted-foreground'
				}
			]}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Sidebar.MenuAction {...props}>
							<Ellipsis />
							<span class="sr-only">Actions</span>
						</Sidebar.MenuAction>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content
					class="grid rounded-lg"
					side={sidebar_context.isMobile ? 'bottom' : 'left'}
					align={sidebar_context.isMobile ? 'end' : 'start'}
				>
					{#each tooltip_data as { trigger_callback, variant, icon, hidden, tooltip_content, className }, i}
						{#if !hidden}
							<DropdownMenu.Item
								class={buttonVariants({
									variant: variant as ButtonVariant,
									className: `w-full ${className}`
								})}
								onclick={() => trigger_callback()}
							>
								{@render icon(i === tooltip_data.length - 1 ? `text-inherit` : undefined)}
								<span>{tooltip_content}</span>
							</DropdownMenu.Item>
						{/if}
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
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
				panel_id_from_tree={node.id}
			/>
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
	bind:open_load_dialog={open_tree_edit_load_action_dialog}
	bind:some_open_state={open_load_context_menu}
	load_to_edit={node}
/>
{#if node.parent_id}
	<UpdatePanelDialog
		panel_to_edit={node}
		{generic_phase_panel_form}
		{highest_unit}
		bind:open_panel_dialog={open_tree_edit_panel_action_dialog}
		bind:some_open_state={open_panel_context_menu}
		parent_id={node.parent_id}
	/>
{/if}

{@render ConfirmationDialogExtended()}

{#snippet ConfirmationDialogExtended()}
	<ConfirmationDialog
		trigger_text={node.node_type === 'root'
			? 'Remove Project'
			: node.node_type === 'panel'
				? 'Remove Panel'
				: 'Remove Load'}
		trigger_variant="destructive"
		bind:open_dialog_state={open_tree_delete_dialog}
		bind:button_state
		onConfirm={async () => {
			button_state = 'processing';
			if (node.node_type === 'root' && project) {
				await deleteProject(project.id);
			} else {
				const removed_node = await removeNode(node.id);
				undo_redo_state.setActionToUndo({
					data: node as PhaseLoadSchedule,
					action: 'delete_node',
					children_nodes: removed_node.children_nodes
				});
			}
			// TODO: Improve invalidation github issue #64
			invalidate('app:workspace/load-schedule')
				.then(() => invalidate('app:workspace'))
				.finally(() => {
					button_state = 'stale';
					open_tree_delete_dialog = false;
					toast.success(
						node.node_type === 'root'
							? `${project?.project_name ?? 'Project'} removed succesfully`
							: node.node_type === 'panel'
								? `${node.panel_data?.name ?? 'Panel'} removed succesfully`
								: `${node.load_data?.load_description ?? 'Load'} removed succesfully`
					);
				});
		}}
	/>
{/snippet}
