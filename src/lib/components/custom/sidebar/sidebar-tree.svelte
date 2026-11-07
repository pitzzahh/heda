<script module lang="ts">
	import {
		CaretRightIcon,
		CircleNotchIcon,
		CopyIcon,
		DatabaseIcon,
		DotsThreeIcon,
		FileArrowUpIcon,
		PencilIcon,
		PlugChargingIcon,
		PlusCircleIcon,
		SidebarIcon,
		SquaresFourIcon,
		TrashIcon
	} from '#lib/assets/icons';
	import type { Node, Project } from '#lib/types/db';

	type TooltipIcon =
		| typeof CopyIcon
		| typeof PencilIcon
		| typeof TrashIcon
		| typeof SquaresFourIcon
		| typeof PlusCircleIcon
		| typeof FileArrowUpIcon;

	interface TooltipAction {
		trigger_callback: () => unknown;
		variant: string;
		icon: TooltipIcon;
		hidden?: boolean;
		className: string;
		tooltip_content: string;
	}

	interface Props {
		node: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		project?: Project;
	}

	interface ComponentState {
		open_copy_dialog: boolean;
		open_panel_context_menu: boolean;
		open_load_context_menu: boolean;
		open_tree_edit_panel_action_dialog: boolean;
		open_tree_edit_load_action_dialog: boolean;
		open_tree_add_panel_dialog: boolean;
		open_tree_add_load_dialog: boolean;
		open_tree_delete_dialog: boolean;
		is_hovering_on_tree_item: boolean;
		button_state: 'stale' | 'processing';
		node_name: string;
		is_alt_pressed: boolean;
	}
</script>

<script lang="ts">
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { cn } from '#lib/utils';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.js';
	import { ConfirmationDialog } from '#lib/components/custom';
	import { SidebarTree, AddPanelAndViewTrigger } from '.';
	import { getChildNodesByParentId } from '#lib/db/queries';
	import {
		copyAndAddNodeById,
		deleteProject,
		removeNode,
		updateNodeParentById
	} from '#lib/db/mutations';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Portal } from 'bits-ui';
	import { UpdatePanelDialog, UpdateLoadDialog } from '.';
	import { AddLoadDialog } from '#lib/components/custom/load';
	import { toast } from 'svelte-sonner';
	import { useSidebar } from '#lib/components/ui/sidebar/context.svelte';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte';
	import { exportToExcel } from '#lib/helpers/export';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte';
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte';
	import { MultiCopyDialog } from '#lib/components/custom';

	let { node, highest_unit, project }: Props = $props();

	const params = $derived(page.params);
	const sidebar_context = useSidebar();
	const settings_state = getSettingsState();
	const db_revisions = getDbRevisionsState();
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();

	let component_state = $state<ComponentState>({
		open_copy_dialog: false,
		open_panel_context_menu: false,
		open_load_context_menu: false,
		open_tree_edit_panel_action_dialog: false,
		open_tree_edit_load_action_dialog: false,
		open_tree_add_panel_dialog: false,
		open_tree_add_load_dialog: false,
		open_tree_delete_dialog: false,
		is_hovering_on_tree_item: false,
		button_state: 'stale',
		node_name: 'Unknown',
		is_alt_pressed: false
	});

	let undo_redo_state = getUndoRedoState();
	let collapsibles = getCollapsiblesState();
	let is_collapsible_open = $derived(collapsibles.checkIsIdExisting(node.id));
	const child_nodes = $derived.by(() => {
		void db_revisions.workspace;
		return getChildNodesByParentId(node.id);
	});

	async function copyNodeById(node_id: string) {
		component_state.node_name =
			node.panel_data?.name || node.load_data?.load_description || 'Unknown';
		if (component_state.open_copy_dialog) return;
		await copyAndAddNodeById(node_id).then((copied_node) => {
			undo_redo_state.setActionToUndo({
				action: 'copy_node',
				data: copied_node as unknown as PhaseLoadSchedule
			});
		});
		db_revisions.bumpWorkspaceAndSchedule();
	}

	// Handle drops between containers
	async function handleDrop(state: DragDropState<Node>, _node: Node) {
		const { draggedItem, targetContainer } = state;
		if (!targetContainer || _node.id === draggedItem.parent_id) {
			toast.warning(
				`Cannot move load ${getNodeName(draggedItem)} to same previous ${getNodeName(_node)} panel`
			);
			return;
		}
		if (_node.id === targetContainer) {
			toast.info(`Setting ${getNodeName(draggedItem)} panel to ${getNodeName(_node)}`);
			const updated_node = await updateNodeParentById(
				{
					id: draggedItem.id,
					parent_id: draggedItem.parent_id
				},
				targetContainer
			);
			undo_redo_state.setActionToUndo({
				action: 'update_node',
				data: updated_node as unknown as PhaseLoadSchedule,
				previous_data: draggedItem as PhaseLoadSchedule
			});
			toast.success(`${getNodeName(draggedItem)} updated successfully`);
			db_revisions.bumpWorkspaceAndSchedule();
			return;
		}
		return;
	}

	function getNodeName(_node?: Node) {
		if (!_node) return 'unknown';
		return _node.node_type === 'root'
			? _node?.highest_unit_form?.distribution_unit
			: _node.node_type === 'panel'
				? _node?.panel_data?.name
				: _node.node_type === 'load'
					? _node?.load_data?.load_description
					: 'unknown';
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Alt') component_state.is_alt_pressed = true;
	}}
	onkeyup={(e) => {
		if (e.key === 'Alt') component_state.is_alt_pressed = false;
	}}
	onfocus={() => {
		component_state.is_alt_pressed = false;
	}}
/>
{#await child_nodes}
	<Sidebar.MenuButton
		class="hover:bg-accent flex w-full items-center justify-between transition-colors data-[active=true]:bg-transparent"
	>
		<Skeleton class="h-6 w-full" />
	</Sidebar.MenuButton>
{:then child_nodes}
	{#if node.node_type === 'load'}
		{#if settings_state.show_loads_on_unit_hierarchy}
			<button
				use:draggable={{ container: node.id, dragData: node }}
				onclick={() => {
					if (component_state.is_alt_pressed) {
						select_nodes_to_delete_state.addOrRemoveNodeId(node.id);
					}
				}}
			>
				<Sidebar.MenuItem class="w-full">
					<Sidebar.MenuButton
						onmouseenter={() => (component_state.is_hovering_on_tree_item = true)}
						onmouseleave={() => (component_state.is_hovering_on_tree_item = false)}
						class="hover:bg-accent active:bg-accent/70 flex w-full items-center transition-colors data-[active=true]:bg-transparent"
					>
						<ContextMenu.Root bind:open={component_state.open_load_context_menu}>
							<ContextMenu.Trigger class="flex w-full items-center gap-1">
								<div class="flex w-full items-center gap-2">
									<div class="w-4">
										<PlugChargingIcon class="size-4" />
									</div>
									<span class="truncate">
										{typeof node === 'string' ? node : node.load_data?.load_description}
									</span>
									{#if select_nodes_to_delete_state.checkIsIdSelected(node.id)}
										<div class="bg-destructive size-2 rounded-full"></div>
									{/if}
								</div>
							</ContextMenu.Trigger>
							<ContextMenu.Content class="grid gap-1">
								<UpdateLoadDialog
									{highest_unit}
									bind:some_open_state={component_state.open_load_context_menu}
									load_to_edit={node}
								/>
								<ConfirmationDialog
									trigger_text="Remove load"
									trigger_variant="destructive"
									bind:some_open_state={component_state.open_load_context_menu}
									onConfirm={async () => {
										await removeNode(node.id);
										db_revisions.bumpWorkspaceAndSchedule();
									}}
								/>
							</ContextMenu.Content>
						</ContextMenu.Root>
					</Sidebar.MenuButton>

					{@const tooltip_data = [
						{
							trigger_callback: async () => {
								component_state.open_copy_dialog = settings_state.is_load_multi_copy;
								await copyNodeById(node.id);
							},
							variant: 'ghost',
							icon: CopyIcon,
							className: 'text-muted-foreground',
							tooltip_content: 'Copy Load'
						},
						{
							trigger_callback: () => (component_state.open_tree_edit_load_action_dialog = true),
							variant: 'ghost',
							icon: PencilIcon,
							hidden: false,
							className: 'text-muted-foreground',
							tooltip_content: `Edit ${node.load_data?.load_description || 'Load'}`
						},
						{
							trigger_callback: () => (component_state.open_tree_delete_dialog = true),
							variant: 'ghost',
							icon: TrashIcon,
							hidden: false,
							tooltip_content: `Remove ${node.load_data?.load_description || 'Load'}`,
							className: 'text-destructive hover:bg-destructive/10!'
						}
					]}
					{@render heirarchy_actions(tooltip_data)}
				</Sidebar.MenuItem>
			</button>
		{/if}
	{:else}
		<Sidebar.MenuItem class="w-full" aria-disabled={component_state.button_state === 'processing'}>
			{@const node_name = (node.highest_unit_form?.distribution_unit ||
				node.panel_data?.name) as string}
			{@const tooltip_data = [
				{
					trigger_callback: () => (component_state.open_tree_add_panel_dialog = true),
					variant: 'ghost',
					icon: SquaresFourIcon,
					hidden: false,
					tooltip_content: 'Add Panel',
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: () => (component_state.open_tree_add_load_dialog = true),
					variant: 'ghost',
					icon: PlusCircleIcon,
					hidden: false,
					tooltip_content: 'Add Load',
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: async () => {
						component_state.open_copy_dialog = settings_state.is_panel_multi_copy;
						await copyNodeById(node.id);
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
						component_state.open_tree_edit_panel_action_dialog = true;
					},
					variant: 'ghost',
					icon: PencilIcon,
					hidden: node.node_type === 'root',
					tooltip_content: `Edit ${node.panel_data?.name || 'Panel'}`,
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: async () => {
						const some_name = node.panel_data?.name ?? 'Panel';
						if (node.node_type !== 'root' && !node.parent_id) {
							return toast.warning(`Cannot identify ${some_name} supply from.`, {
								description:
									'This is a system error and should not be here, the error has been logged.',
								position: 'bottom-center'
							});
						}
						exportToExcel(
							'LOAD_SCHEDULE',
							node.id,
							highest_unit,
							node.node_type === 'root' ? `${project?.project_name ?? 'Project'}` : some_name
						);
					},
					variant: 'ghost',
					icon: FileArrowUpIcon,
					hidden: false,
					tooltip_content:
						node.node_type === 'root'
							? `Export ${project?.project_name ?? 'Project'}`
							: `Export ${node.panel_data?.name ?? 'Panel'}`,
					className: 'text-muted-foreground'
				},
				{
					trigger_callback: () => (component_state.open_tree_delete_dialog = true),
					variant: 'ghost',
					icon: TrashIcon,
					hidden: false,
					tooltip_content: node.node_type === 'root' ? 'Remove Project' : 'Remove Panel',
					className: 'text-destructive hover:bg-destructive/10!'
				}
			]}

			<Collapsible.Root open={is_collapsible_open} class="group/collapsible">
				<button
					onclick={() => {
						if (component_state.is_alt_pressed && node.node_type === 'panel') {
							select_nodes_to_delete_state.addOrRemoveNodeId(node.id);
						} else {
							const current_id = params.id?.split('_').at(-1);
							if (current_id !== node.id) {
								component_state.button_state = 'processing';
								goto(
									resolve('/(workspaces)/workspace/load-schedule/[id]', {
										id: node_name + '_' + node.id
									})
								).finally(() => (component_state.button_state = 'stale'));
							}
						}
					}}
					class={cn('w-full', {
						'cursor-not-allowed': component_state.button_state === 'processing'
					})}
					use:droppable={{
						container: node.id,
						callbacks: { onDrop: async (state: DragDropState<Node>) => handleDrop(state, node) }
					}}
				>
					<Sidebar.MenuButton
						class={cn('hover:bg-accent data-[active=true]:bg-accent relative transition-colors', {
							'bg-accent shadow-[inset_2px_0_0_0_var(--primary)]':
								params.id && params.id.split('_').at(-1) === node.id,
							'cursor-not-allowed opacity-50': component_state.button_state === 'processing'
						})}
					>
						<Collapsible.Trigger>
							{#snippet child({ props })}
								<CaretRightIcon
									{...props}
									weight="bold"
									class="text-muted-foreground hover:text-foreground size-4 shrink-0 cursor-pointer transition-[rotate] duration-(--duration-exit) ease-(--ease-ui-out) data-[state=open]:rotate-90 motion-reduce:transition-none"
									onclick={(e) => {
										e.stopPropagation();
										collapsibles.toggleCollapsible(node.id);
									}}
								/>
							{/snippet}
						</Collapsible.Trigger>
						<ContextMenu.Root bind:open={component_state.open_panel_context_menu}>
							<ContextMenu.Trigger class="flex w-full items-center justify-between">
								<div
									use:draggable={{
										container: node?.panel_data?.name ?? 'unknown_panel',
										dragData: node
									}}
								>
									<AddPanelAndViewTrigger
										id={node.id}
										panel_name={node_name}
										{highest_unit}
										parent_id={node.id}
										latest_circuit_node={child_nodes
											? child_nodes[child_nodes.length - 1]
											: undefined}
									>
										<CircleNotchIcon
											class={cn('hidden h-4 w-4 animate-spin', {
												block: component_state.button_state === 'processing'
											})}
										/>
										{#if node.node_type === 'root'}
											<div class="w-4">
												<DatabaseIcon class="size-4" />
											</div>
										{:else if node.node_type === 'panel'}
											<div class="w-4"><SidebarIcon class="size-4" /></div>
										{/if}
										<span class="truncate">
											{node_name}
										</span>
										{#if select_nodes_to_delete_state.checkIsIdSelected(node.id)}
											<div class="bg-destructive size-2 rounded-full"></div>
										{/if}
									</AddPanelAndViewTrigger>
								</div>
							</ContextMenu.Trigger>

							<ContextMenu.Content class="grid gap-1">
								{#if node.node_type === 'panel' && node.parent_id}
									<UpdatePanelDialog
										panel_to_edit={node}
										{highest_unit}
										trigger_text={`Edit ${node.panel_data?.name || 'Panel'}`}
										show_trigger={true}
										bind:some_open_state={component_state.open_panel_context_menu}
										parent_id={node.parent_id}
									/>
								{/if}
								<ConfirmationDialog
									show_trigger={true}
									trigger_text={node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}
									trigger_variant="destructive"
									bind:button_state={component_state.button_state}
									bind:some_open_state={component_state.open_panel_context_menu}
									onConfirm={async () => {
										if (node.node_type === 'root' && project) {
											await deleteProject(project.id);
										} else {
											const removed_node = await removeNode(node.id);

											if (removed_node) {
												undo_redo_state.setActionToUndo({
													data: node as PhaseLoadSchedule,
													action: 'delete_node',
													children_nodes: removed_node.children_nodes
												});
												select_nodes_to_delete_state.removeNodeId(node.id); //remove the node id in the list of ever it is selected
											}
										}
										db_revisions.bumpWorkspaceAndSchedule();
										component_state.button_state = 'stale';
										toast.success(
											node.node_type === 'root'
												? `${project?.project_name ?? 'Project'} removed succesfully`
												: `${node.panel_data?.name ?? 'Panel'} removed succesfully`
										);
									}}
								/>
							</ContextMenu.Content>
						</ContextMenu.Root>
					</Sidebar.MenuButton>
				</button>
				<Collapsible.Content class="w-full">
					<Sidebar.MenuSub class="w-full">
						{#each child_nodes as child, index (index)}
							<SidebarTree node={child} {highest_unit} />
						{/each}
					</Sidebar.MenuSub>
				</Collapsible.Content>
			</Collapsible.Root>

			{@render heirarchy_actions(tooltip_data)}

			<AddPanelAndViewTrigger
				id={node.id}
				panel_name={node_name}
				{highest_unit}
				parent_id={node.id}
				bind:open_dialog_state={component_state.open_tree_add_panel_dialog}
				latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
			/>
			<AddLoadDialog
				{highest_unit}
				remove_trigger={true}
				bind:open_dialog_state={component_state.open_tree_add_load_dialog}
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
	remove_trigger={true}
	bind:open_load_dialog={component_state.open_tree_edit_load_action_dialog}
	bind:some_open_state={component_state.open_load_context_menu}
	load_to_edit={node}
/>
{#if node.parent_id}
	<UpdatePanelDialog
		panel_to_edit={node}
		{highest_unit}
		bind:open_panel_dialog={component_state.open_tree_edit_panel_action_dialog}
		bind:some_open_state={component_state.open_panel_context_menu}
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
		bind:open_dialog_state={component_state.open_tree_delete_dialog}
		bind:button_state={component_state.button_state}
		onConfirm={async () => {
			component_state.button_state = 'processing';
			const toast_id = toast.loading(
				node.node_type === 'root'
					? `Removing ${project?.project_name ?? 'Project'}`
					: node.node_type === 'panel'
						? `Removing ${node.panel_data?.name ?? 'Panel'}`
						: `Removing ${node.load_data?.load_description ?? 'Load'}`
			);
			if (node.node_type === 'root' && project) {
				await deleteProject(project.id);
				collapsibles.removeAllNodeId();
			} else {
				const removed_node = await removeNode(node.id);

				if (removed_node) {
					undo_redo_state.setActionToUndo({
						data: node as PhaseLoadSchedule,
						action: 'delete_node',
						children_nodes: removed_node.children_nodes
					});
					collapsibles.removeNodeId(node.id);
					select_nodes_to_delete_state.removeNodeId(node.id); //remove the node id in the list of ever it is selected
				}
			}
			db_revisions.bumpWorkspaceAndSchedule();
			component_state.button_state = 'stale';
			component_state.open_tree_delete_dialog = false;
			toast.success(
				node.node_type === 'root'
					? `${project?.project_name ?? 'Project'} removed succesfully`
					: node.node_type === 'panel'
						? `${node.panel_data?.name ?? 'Panel'} removed succesfully`
						: `${node.load_data?.load_description ?? 'Load'} removed succesfully`,
				{ id: toast_id }
			);
		}}
	/>
{/snippet}

{#snippet heirarchy_actions(tooltip_data: TooltipAction[])}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class="mr-2">
			{#snippet child({ props })}
				<Sidebar.MenuAction {...props}>
					<DotsThreeIcon />
					<span class="sr-only">Actions</span>
				</Sidebar.MenuAction>
			{/snippet}
		</DropdownMenu.Trigger>
		<Portal>
			<DropdownMenu.Content
				class="grid rounded-lg"
				side={sidebar_context.isMobile ? 'bottom' : 'right'}
				align={sidebar_context.isMobile ? 'end' : 'start'}
			>
				<DropdownMenu.Group>
					{#each tooltip_data as { trigger_callback, icon, hidden, tooltip_content, className }, i (tooltip_content)}
						{#if !hidden}
							<DropdownMenu.Item onclick={() => trigger_callback()} class={cn('z-auto', className)}>
								{@const Icon = icon}
								<Icon class={i === tooltip_data.length - 1 ? 'text-inherit' : undefined} />
								<span class="text-sm">{tooltip_content}</span>
							</DropdownMenu.Item>
						{/if}
					{/each}
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</Portal>
	</DropdownMenu.Root>
{/snippet}

<MultiCopyDialog
	bind:open_dialog={component_state.open_copy_dialog}
	node_name={component_state.node_name}
	node_id={node.id}
/>
