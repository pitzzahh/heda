import type { Node, Project } from '#lib/types/db/index.js';
import type { UndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
import type { Collapsibles } from '#lib/hooks/node-collapsibles.svelte.js';
import type { SelectNodesToDelete } from '#lib/hooks/select-nodes-to-delete.svelte.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import { deleteProject, removeNode } from '#lib/db/mutations/index.js';

export function deleteNodeAndRecordUndo(
	node: Node,
	project: Project | undefined,
	stores: {
		undo_redo: UndoRedoState;
		collapsibles: Collapsibles;
		select_nodes_to_delete: SelectNodesToDelete;
	}
) {
	if (node.node_type === 'root' && project) {
		deleteProject(project.id);
		stores.collapsibles.removeAllNodeId();
		return;
	}
	const removed_node = removeNode(node.id);
	if (!removed_node) return;
	stores.undo_redo.setActionToUndo({
		data: node as PhaseLoadSchedule,
		action: 'delete_node',
		children_nodes: removed_node.children_nodes
	});
	stores.collapsibles.removeNodeId(node.id);
	stores.select_nodes_to_delete.removeNodeId(node.id);
}
