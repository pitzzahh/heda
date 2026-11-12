<script lang="ts" module>
	import type { Node, Project } from '#lib/types/db/index.js';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
	import type { DragDropState } from '@thisux/sveltednd';

	interface Props {
		node: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		project?: Project;
		is_alt_pressed: boolean;
		on_copy: (node_id: string, multi_copy: boolean) => void;
		on_delete: () => void;
	}
</script>

<script lang="ts">
	import {
		CaretRightIcon,
		CircleNotchIcon,
		CopyIcon,
		DatabaseIcon,
		FileArrowUpIcon,
		PencilIcon,
		PlusCircleIcon,
		SidebarIcon,
		SquaresFourIcon,
		TrashIcon
	} from '#lib/assets/icons/index.js';
	import * as Collapsible from '#lib/components/ui/collapsible/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.js';
	import ConfirmationDialog from '#lib/components/custom/confirmation-dialog.svelte';
	import AddPanelAndViewTrigger from '../add-panel-and-view-trigger.svelte';
	import UpdatePanelDialog from '../update-panel-dialog.svelte';
	import AddLoadDialog from '#lib/components/custom/load/add-load-dialog.svelte';
	import TreeActionsMenu from './tree-actions-menu.svelte';
	import { getChildNodesByParentId } from '#lib/db/queries/index.js';
	import { deleteNodeAndRecordUndo } from '../tree-delete.js';
	import { updateNodeParentById } from '#lib/db/mutations/index.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { exportToExcel } from '#lib/helpers/export/index.js';
	import { loadScheduleRouteId, nodeIdFromRouteId } from '#lib/helpers/navigation/index.js';
	import { draggable, droppable } from '@thisux/sveltednd';
	import { toast } from 'svelte-sonner';
	import { cn } from '#lib/utils/index.js';

	let { node, highest_unit, project, is_alt_pressed, on_copy, on_delete }: Props = $props();

	const settings_state = getSettingsState();
	const undo_redo_state = getUndoRedoState();
	const collapsibles = getCollapsiblesState();
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();

	const params = $derived(page.params);
	const child_nodes = $derived(getChildNodesByParentId(node.id));
	const is_collapsible_open = $derived(collapsibles.checkIsIdExisting(node.id));
	const has_visible_children = $derived(
		child_nodes.some(
			(child) =>
				child.node_type === 'panel' ||
				(child.node_type === 'load' && settings_state.show_loads_on_unit_hierarchy)
		)
	);

	let menu_open = $state(false);
	let edit_dialog_open = $state(false);
	let add_panel_open = $state(false);
	let add_load_open = $state(false);
	let button_state = $state<'stale' | 'processing'>('stale');

	const node_name = $derived(
		(node.highest_unit_form?.distribution_unit || node.panel_data?.name) as string
	);

	const tooltip_data = $derived([
		{
			trigger_callback: () => (add_panel_open = true),
			variant: 'ghost',
			icon: SquaresFourIcon,
			hidden: false,
			tooltip_content: 'Add Panel',
			className: 'text-muted-foreground'
		},
		{
			trigger_callback: () => (add_load_open = true),
			variant: 'ghost',
			icon: PlusCircleIcon,
			hidden: false,
			tooltip_content: 'Add Load',
			className: 'text-muted-foreground'
		},
		{
			trigger_callback: () => on_copy(node.id, settings_state.is_panel_multi_copy),
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
						description: 'This is a system error and should not be here, the error has been logged.'
					});
				}
				edit_dialog_open = true;
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
			trigger_callback: () => on_delete(),
			variant: 'ghost',
			icon: TrashIcon,
			hidden: false,
			tooltip_content: node.node_type === 'root' ? 'Remove Project' : 'Remove Panel',
			className: 'text-destructive hover:bg-destructive/10!'
		}
	]);

	function handleDrop(state: DragDropState<Node>, _node: Node) {
		const { draggedItem, targetContainer } = state;
		if (!targetContainer || _node.id === draggedItem.parent_id) {
			toast.warning(
				`Cannot move load ${getNodeName(draggedItem)} to same previous ${getNodeName(_node)} panel`
			);
			return;
		}
		if (_node.id === targetContainer) {
			toast.info(`Setting ${getNodeName(draggedItem)} panel to ${getNodeName(_node)}`);
			const updated_node = updateNodeParentById(
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

<div
	data-sidebar="menu-item"
	class="group/menu-item relative w-full"
	aria-disabled={button_state === 'processing'}
>
	<Collapsible.Root open={is_collapsible_open} class="group/collapsible">
		<button
			onclick={() => {
				if (is_alt_pressed && node.node_type === 'panel') {
					select_nodes_to_delete_state.addOrRemoveNodeId(node.id);
				} else {
					const current_id = nodeIdFromRouteId(params.id);
					if (current_id !== node.id) {
						button_state = 'processing';
						goto(
							resolve('/(workspaces)/workspace/load-schedule/[id]', {
								id: loadScheduleRouteId(node_name, node.id)
							})
						).finally(() => (button_state = 'stale'));
					}
				}
			}}
			class={cn('w-full', {
				'cursor-not-allowed': button_state === 'processing'
			})}
			use:droppable={{
				container: node.id,
				callbacks: { onDrop: async (state: DragDropState<Node>) => handleDrop(state, node) }
			}}
		>
			<Sidebar.MenuButton
				class={cn('relative transition-colors hover:bg-accent data-[active=true]:bg-accent', {
					'bg-accent shadow-[inset_2px_0_0_0_var(--primary)]':
						params.id && nodeIdFromRouteId(params.id) === node.id,
					'cursor-not-allowed opacity-50': button_state === 'processing'
				})}
			>
				{#if has_visible_children}
					<Collapsible.Trigger>
						{#snippet child({ props })}
							<CaretRightIcon
								{...props}
								weight="bold"
								class="size-4 shrink-0 cursor-pointer text-muted-foreground transition-[rotate] duration-(--duration-exit) ease-(--ease-ui-out) hover:text-foreground data-[state=open]:rotate-90 motion-reduce:transition-none"
								onclick={(e) => {
									e.stopPropagation();
									collapsibles.toggleCollapsible(node.id);
								}}
							/>
						{/snippet}
					</Collapsible.Trigger>
				{/if}
				<ContextMenu.Root bind:open={menu_open}>
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
								latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
							>
								<CircleNotchIcon
									class={cn('hidden h-4 w-4 animate-spin', {
										block: button_state === 'processing'
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
									<div class="size-2 rounded-full bg-destructive"></div>
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
								bind:some_open_state={menu_open}
								parent_id={node.parent_id}
							/>
						{/if}
						<ConfirmationDialog
							show_trigger={true}
							trigger_text={node.node_type === 'root' ? 'Remove Project' : 'Remove Panel'}
							trigger_variant="destructive"
							bind:button_state
							bind:some_open_state={menu_open}
							onConfirm={() => {
								deleteNodeAndRecordUndo(node, project, {
									undo_redo: undo_redo_state,
									collapsibles,
									select_nodes_to_delete: select_nodes_to_delete_state
								});
								button_state = 'stale';
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
	</Collapsible.Root>

	<TreeActionsMenu actions={tooltip_data} />

	<AddPanelAndViewTrigger
		id={node.id}
		panel_name={node_name}
		{highest_unit}
		parent_id={node.id}
		bind:open_dialog_state={add_panel_open}
		latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
	/>
	<AddLoadDialog
		{highest_unit}
		remove_trigger={true}
		bind:open_dialog_state={add_load_open}
		latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
		panel_id_from_tree={node.id}
	/>
</div>

{#if node.parent_id}
	<UpdatePanelDialog
		panel_to_edit={node}
		{highest_unit}
		bind:open_panel_dialog={edit_dialog_open}
		bind:some_open_state={menu_open}
		parent_id={node.parent_id}
	/>
{/if}
