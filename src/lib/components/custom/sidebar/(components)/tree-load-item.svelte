<script lang="ts" module>
	import type { Node } from '#lib/types/db/index.js';

	interface Props {
		node: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		is_alt_pressed: boolean;
		on_copy: (node_id: string, multi_copy: boolean) => void;
		on_delete: () => void;
	}
</script>

<script lang="ts">
	import { CopyIcon, PencilIcon, PlugChargingIcon, TrashIcon } from '#lib/assets/icons/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import * as ContextMenu from '#lib/components/ui/context-menu/index.js';
	import ConfirmationDialog from '#lib/components/custom/confirmation-dialog.svelte';
	import UpdateLoadDialog from '../update-load-dialog.svelte';
	import TreeActionsMenu from './tree-actions-menu.svelte';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import { removeNode } from '#lib/db/mutations/index.js';
	import { draggable } from '@thisux/sveltednd';

	let { node, highest_unit, is_alt_pressed, on_copy, on_delete }: Props = $props();

	const settings_state = getSettingsState();
	const select_nodes_to_delete_state = getSelectNodesToDeleteState();

	let menu_open = $state(false);
	let edit_dialog_open = $state(false);

	const tooltip_data = $derived([
		{
			trigger_callback: () => on_copy(node.id, settings_state.is_load_multi_copy),
			variant: 'ghost',
			icon: CopyIcon,
			className: 'text-muted-foreground',
			tooltip_content: 'Copy Load'
		},
		{
			trigger_callback: () => (edit_dialog_open = true),
			variant: 'ghost',
			icon: PencilIcon,
			hidden: false,
			className: 'text-muted-foreground',
			tooltip_content: `Edit ${node.load_data?.load_description || 'Load'}`
		},
		{
			trigger_callback: () => on_delete(),
			variant: 'ghost',
			icon: TrashIcon,
			hidden: false,
			tooltip_content: `Remove ${node.load_data?.load_description || 'Load'}`,
			className: 'text-destructive hover:bg-destructive/10!'
		}
	]);
</script>

<div data-sidebar="menu-item" class="group/menu-item relative w-full">
	<div use:draggable={{ container: node.id, dragData: node }}>
		<Sidebar.MenuButton
			class="hover:bg-accent active:bg-accent/70 flex w-full items-center transition-colors data-[active=true]:bg-transparent"
			onclick={() => {
				if (is_alt_pressed) {
					select_nodes_to_delete_state.addOrRemoveNodeId(node.id);
				}
			}}
		>
			<ContextMenu.Root bind:open={menu_open}>
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
					<UpdateLoadDialog {highest_unit} bind:some_open_state={menu_open} load_to_edit={node} />
					<ConfirmationDialog
						trigger_text="Remove load"
						trigger_variant="destructive"
						bind:some_open_state={menu_open}
						onConfirm={() => {
							removeNode(node.id);
						}}
					/>
				</ContextMenu.Content>
			</ContextMenu.Root>
		</Sidebar.MenuButton>
	</div>

	<TreeActionsMenu actions={tooltip_data} />
</div>

<UpdateLoadDialog
	{highest_unit}
	remove_trigger={true}
	bind:open_load_dialog={edit_dialog_open}
	bind:some_open_state={menu_open}
	load_to_edit={node}
/>
