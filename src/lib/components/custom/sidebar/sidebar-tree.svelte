<script module lang="ts">
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
		multi_copy: {
			valid: boolean;
			value: number;
			processing: boolean;
			might_take_long: boolean;
			error?: string;
		};
	}
</script>

<script lang="ts">
	import * as Collapsible from '@/components/ui/collapsible/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import * as Alert from '@/components/ui/alert/index.js';
	import { Input } from '@/components/ui/input/index.js';
	import { Label } from '@/components/ui/label/index.js';
	import { cn } from '@/utils';
	import { Skeleton } from '@/components/ui/skeleton/index.js';
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';
	import * as ContextMenu from '@/components/ui/context-menu/index.js';
	import {
		ChevronRight,
		CircleAlert,
		DatabaseZap,
		Ellipsis,
		FileUp,
		PlugZap,
		Loader,
		PanelsLeftBottom,
		CirclePlus,
		Copy,
		Grid2x2Plus,
		Pencil,
		Trash2
	} from '@/assets/icons';
	import { ConfirmationDialog } from '@/components/custom';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import { SidebarTree, AddPanelAndViewTrigger } from '.';
	import { getChildNodesByParentId, getNumberOfChildren } from '@/db/queries';
	import { copyAndAddNodeById, deleteProject, removeNode } from '@/db/mutations';
	import { invalidate } from '$app/navigation';
	import type { Node, Project } from '@/db/schema';
	import { page } from '$app/state';
	import { Portal } from 'bits-ui';
	import { UpdatePanelDialog, UpdateLoadDialog } from '.';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';
	import { AddLoadDialog } from '@/components/custom/load';
	import { toast } from 'svelte-sonner';
	import { useSidebar } from '@/components/ui/sidebar/context.svelte';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { Collapsibles } from '@/hooks/node-collapsibles.svelte';
	import { exportToExcel } from '@/helpers/export';
	import { getSettingsState } from '@/hooks/settings-state.svelte';
	import { Button } from '@/components/ui/button';
	import { draggable, droppable, type DragDropState } from '@thisux/sveltednd';

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
	const settings_state = getSettingsState();
	// const select_nodes_to_delete_state = getSelectNodesToDeleteState();

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
		multi_copy: { valid: true, value: 1, processing: false, might_take_long: false }
	});

	let undo_redo_state = getUndoRedoState();
	let collapsibles = new Collapsibles();

	async function copyNodeById(node_id: string) {
		component_state.node_name =
			node.panel_data?.name || node.load_data?.load_description || 'Unknown';
		if (component_state.open_copy_dialog) return;
		await copyAndAddNodeById(node_id)
			.then((copied_node) => {
				undo_redo_state.setActionToUndo({
					action: 'copy_node',
					data: copied_node as unknown as PhaseLoadSchedule
				});
				invalidate('app:workspace');
			})
			.finally(() => invalidate('app:workspace/load-schedule'));
	}

	async function handleMultiCopy(node_id: string) {
		if (!component_state.multi_copy.valid) {
			return toast.warning('Invalid copy count, must be greater than 0');
		}
		component_state.multi_copy.processing = true;
		const copy_count = Number(component_state.multi_copy.value);
		let latest_node = await copyAndAddNodeById(node_id);

		if (latest_node) {
			if (latest_node.node_type === 'panel') {
				// check if might_take_some_time
				const child_count = await getNumberOfChildren(node_id);
				component_state.multi_copy.might_take_long = child_count >= 15;
			} else if (latest_node.node_type === 'load') {
				// check if might_take_some_time
				component_state.multi_copy.might_take_long = copy_count >= 15;
			}

			for (let i = 1; i < copy_count; i++) {
				latest_node = await copyAndAddNodeById(latest_node.id);

				if (!latest_node) {
					component_state.multi_copy.processing = false;
					return toast.error('An error occurred while copying nodes.');
				}

				undo_redo_state.setActionToUndo({
					action: 'copy_node',
					data: latest_node as unknown as PhaseLoadSchedule
				});
			}

			component_state.multi_copy.processing = false;
			component_state.open_copy_dialog = false;
			await invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
			return toast.success(`[${copy_count}]: ${component_state.node_name} copied successfully`);
		} else {
			component_state.multi_copy.processing = false;
			return toast.error('Failed to copy the initial node.');
		}
	}

	// Handle drops between containers
	async function handleDrop(state: DragDropState<{ id: string }>) {
		const { draggedItem, sourceContainer, targetContainer } = state;
		if (!targetContainer || sourceContainer === targetContainer) return;
	}
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
		{#if settings_state.show_loads_on_unit_hierarchy}
			<div use:draggable={{ container: 'panel', dragData: node }}>
				<Sidebar.MenuItem class="w-full">
					<Sidebar.MenuButton
						onmouseenter={() => (component_state.is_hovering_on_tree_item = true)}
						onmouseleave={() => (component_state.is_hovering_on_tree_item = false)}
						class="flex w-full items-center hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-transparent"
					>
						<ContextMenu.Root bind:open={component_state.open_load_context_menu}>
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
										bind:some_open_state={component_state.open_load_context_menu}
										load_to_edit={node}
									/>
									<ConfirmationDialog
										trigger_text="Remove load"
										trigger_variant="destructive"
										bind:some_open_state={component_state.open_load_context_menu}
										onConfirm={async () => {
											await removeNode(node.id)
												.then(() => invalidate('app:workspace'))
												.finally(() => invalidate('app:workspace/load-schedule'));
										}}
									/>
								{/snippet}
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
							icon: Copy,
							className: 'text-muted-foreground',
							tooltip_content: 'Copy Load'
						},
						{
							trigger_callback: () => (component_state.open_tree_edit_load_action_dialog = true),
							variant: 'ghost',
							icon: Pencil,
							hidden: false,
							className: 'text-muted-foreground',
							tooltip_content: `Edit ${node.load_data?.load_description || 'Load'}`
						},
						{
							trigger_callback: () => (component_state.open_tree_delete_dialog = true),
							variant: 'ghost',
							icon: Trash2,
							hidden: false,
							tooltip_content: `Remove ${node.load_data?.load_description || 'Load'}`,
							className: '!text-red-600 hover:!bg-red-600/10'
						}
					]}
					{@render heirarchy_actions(tooltip_data)}
				</Sidebar.MenuItem>
			</div>
		{/if}
	{:else}
		<div
			use:droppable={{ container: 'panel', callbacks: { onDrop: handleDrop } }}
			use:draggable={{ container: 'panel', dragData: node }}
		>
			<Sidebar.MenuItem class="w-full">
				<Collapsible.Root
					open={node.node_type === 'root' ? true : collapsibles.checkIsIdExisting(node.id)}
					class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
				>
					<Sidebar.MenuButton
						onmouseenter={() => (component_state.is_hovering_on_tree_item = true)}
						onmouseleave={() => (component_state.is_hovering_on_tree_item = false)}
						class={cn(
							'relative hover:bg-primary/20 active:bg-primary/20 data-[active=true]:bg-primary/20',
							{
								'bg-primary/20': params.id && params.id.split('_').at(-1) === node.id
							}
						)}
					>
						<Collapsible.Trigger>
							{#snippet child({ props })}
								<ChevronRight
									class="transition-transform"
									{...props}
									onclick={() => collapsibles.toggleCollapsible(node.id)}
								/>
							{/snippet}
						</Collapsible.Trigger>
						<ContextMenu.Root bind:open={component_state.open_panel_context_menu}>
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
									latest_circuit_node={child_nodes
										? child_nodes[child_nodes.length - 1]
										: undefined}
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
												}
											}
											invalidate('app:workspace/load-schedule')
												.then(() => (component_state.button_state = 'stale'))
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
						trigger_callback: () => (component_state.open_tree_add_panel_dialog = true),
						variant: 'ghost',
						icon: Grid2x2Plus,
						hidden: false,
						tooltip_content: 'Add Panel',
						className: 'text-muted-foreground'
					},
					{
						trigger_callback: () => (component_state.open_tree_add_load_dialog = true),
						variant: 'ghost',
						icon: CirclePlus,
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
						icon: Copy,
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
						icon: Pencil,
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
							console.log('Exporting to excel', node);
							exportToExcel(
								node.id,
								highest_unit,
								node.node_type === 'root' ? `${project?.project_name ?? 'Project'}` : some_name
							);
						},
						variant: 'ghost',
						icon: FileUp,
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
						icon: Trash2,
						hidden: false,
						tooltip_content: node.node_type === 'root' ? 'Remove Project' : 'Remove Panel',
						className: '!text-red-600 hover:!bg-red-600/10'
					}
				]}
				{@render heirarchy_actions(tooltip_data)}
				{@const node_name = (node.highest_unit_form?.distribution_unit ||
					node.panel_data?.name) as string}
				<AddPanelAndViewTrigger
					id={node.id}
					panel_name={node_name}
					{generic_phase_panel_form}
					{highest_unit}
					is_parent_root_node={node.node_type === 'root'}
					parent_id={node.id}
					bind:open_dialog_state={component_state.open_tree_add_panel_dialog}
					latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
				/>
				<AddLoadDialog
					{phase_main_load_form}
					{highest_unit}
					remove_trigger={true}
					bind:open_dialog_state={component_state.open_tree_add_load_dialog}
					latest_circuit_node={child_nodes ? child_nodes[child_nodes.length - 1] : undefined}
					panel_id_from_tree={node.id}
				/>
			</Sidebar.MenuItem>
		</div>
	{/if}
{:catch error}
	<!-- TODO: Enhance error page -->
	<p style="color: red">{error.message}</p>
{/await}

<UpdateLoadDialog
	{highest_unit}
	{phase_main_load_form}
	remove_trigger={true}
	bind:open_load_dialog={component_state.open_tree_edit_load_action_dialog}
	bind:some_open_state={component_state.open_load_context_menu}
	load_to_edit={node}
/>
{#if node.parent_id}
	<UpdatePanelDialog
		panel_to_edit={node}
		{generic_phase_panel_form}
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
				}
			}
			invalidate('app:workspace')
				.then(() => invalidate('app:workspace/load-schedule'))
				.finally(() => {
					component_state.button_state = 'stale';
					component_state.open_tree_delete_dialog = false;
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

{#snippet heirarchy_actions(tooltip_data: any[])}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger class="mr-2">
			{#snippet child({ props })}
				<Sidebar.MenuAction {...props}>
					<Ellipsis />
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
					{#each tooltip_data as { trigger_callback, variant, icon, hidden, tooltip_content, className }, i}
						{#if !hidden}
							<DropdownMenu.Item onclick={() => trigger_callback()} class={cn('z-auto', className)}>
								{@render icon(i === tooltip_data.length - 1 ? `text-inherit` : undefined)}
								<span class="text-sm">{tooltip_content}</span>
							</DropdownMenu.Item>
						{/if}
					{/each}
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</Portal>
	</DropdownMenu.Root>
{/snippet}

<Dialog.Root bind:open={component_state.open_copy_dialog}>
	<Dialog.Content class="sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title>Copy {component_state.node_name}</Dialog.Title>
			<Dialog.Description
				>Specify the number of {component_state.node_name} to be copied.</Dialog.Description
			>
		</Dialog.Header>
		{#if !component_state.multi_copy.valid}
			<Alert.Root variant="warning">
				<CircleAlert class="size-4" />
				<Alert.Description
					>{component_state.multi_copy.error ??
						'Invalid copy count, must be greater than 0'}.</Alert.Description
				>
			</Alert.Root>
		{/if}
		<div class="grid grid-cols-4 items-center gap-4">
			<Label for="copy_count" class="text-right">Copy count</Label>
			<Input
				id="copy_count"
				type="number"
				placeholder="Enter the circuit number"
				bind:value={component_state.multi_copy.value}
				class={cn('col-span-3', {
					'border-red-600 outline-red-600 ring ring-red-600': !component_state.multi_copy.valid
				})}
			/>
		</div>
		<Dialog.Footer>
			<Button type="submit" onclick={() => handleMultiCopy(node.id)}>
				<Loader
					class={cn('mr-1 hidden h-4 w-4 animate-spin', {
						block: component_state.multi_copy.processing
					})}
				/>
				<span>Copy</span>
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
