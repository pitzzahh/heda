import type { Node } from '#lib/types/db/index.js';

export type TreeRow = {
	node: Node;
	depth: number;
};

export type FlattenTreeOptions = {
	is_expanded: (node_id: string) => boolean;
	show_loads: boolean;
	get_children: (parent_id: string) => Node[];
};

/**
 * Flattens the visible part of a unit hierarchy into depth-tagged rows.
 *
 * Collapsed units contribute only their own row, and loads are skipped entirely
 * when the hierarchy is set to hide them. Load nodes never recurse.
 */
export function flattenVisibleTree(root: Node, options: FlattenTreeOptions): TreeRow[] {
	const rows: TreeRow[] = [];

	const visit = (node: Node, depth: number) => {
		if (node.node_type === 'load' && !options.show_loads) return;

		rows.push({ node, depth });

		if (node.node_type === 'load') return;
		if (!options.is_expanded(node.id)) return;

		for (const child of options.get_children(node.id)) visit(child, depth + 1);
	};

	visit(root, 0);
	return rows;
}
