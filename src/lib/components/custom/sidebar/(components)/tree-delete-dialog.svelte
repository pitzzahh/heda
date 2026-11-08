<script lang="ts" module>
	import type { Node, Project } from '#lib/types/db/index.js';
	import { deleteNodeAndRecordUndo } from '../tree-delete.js';

	interface Props {
		node: Node;
		project?: Project;
		open: boolean;
		button_state: 'stale' | 'processing';
	}
</script>

<script lang="ts">
	import ConfirmationDialog from '#lib/components/custom/confirmation-dialog.svelte';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { getSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import { toast } from 'svelte-sonner';

	let { node, project, open = $bindable(), button_state = $bindable() }: Props = $props();

	let undo_redo_state = getUndoRedoState();
	let collapsibles = getCollapsiblesState();
	let select_nodes_to_delete_state = getSelectNodesToDeleteState();

	function handleConfirm() {
		button_state = 'processing';
		const toast_id = toast.loading(
			node.node_type === 'root'
				? `Removing ${project?.project_name ?? 'Project'}`
				: node.node_type === 'panel'
					? `Removing ${node.panel_data?.name ?? 'Panel'}`
					: `Removing ${node.load_data?.load_description ?? 'Load'}`
		);
		deleteNodeAndRecordUndo(node, project, {
			undo_redo: undo_redo_state,
			collapsibles,
			select_nodes_to_delete: select_nodes_to_delete_state
		});
		button_state = 'stale';
		open = false;
		toast.success(
			node.node_type === 'root'
				? `${project?.project_name ?? 'Project'} removed succesfully`
				: node.node_type === 'panel'
					? `${node.panel_data?.name ?? 'Panel'} removed succesfully`
					: `${node.load_data?.load_description ?? 'Load'} removed succesfully`,
			{ id: toast_id }
		);
	}
</script>

<ConfirmationDialog
	trigger_text={node.node_type === 'root'
		? 'Remove Project'
		: node.node_type === 'panel'
			? 'Remove Panel'
			: 'Remove Load'}
	trigger_variant="destructive"
	bind:open_dialog_state={open}
	bind:button_state
	onConfirm={handleConfirm}
/>
