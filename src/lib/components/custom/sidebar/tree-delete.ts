import type { Node, Project } from '#lib/types/db.js';
import type { Collapsibles } from '#lib/hooks/node-collapsibles.svelte.js';
import type { SelectNodesToDelete } from '#lib/hooks/select-nodes-to-delete.svelte.js';
import { deleteProject, removeNode } from '#lib/db/mutations/index.js';

/** Removes a circuit with its subtree, or the whole project for the root. */
export async function deleteTreeNode(
	node: Node,
	project: Project | undefined,
	stores: {
		collapsibles: Collapsibles;
		select_nodes_to_delete: SelectNodesToDelete;
	}
) {
	if (node.node_type === 'root' && project) {
		deleteProject(project.id);
		stores.collapsibles.removeAllNodeId();
		return;
	}
	if ((await removeNode(node.id)) === 0) return;
	stores.collapsibles.removeNodeId(node.id);
	stores.select_nodes_to_delete.removeNodeId(node.id);
}
