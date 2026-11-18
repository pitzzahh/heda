import { computed_load_arrays, merged_rows, reuseArrayIfEqual } from './cache.js';
import { getChildren, loadSnapshot } from './snapshot.js';
import { getRow } from '../index.js';
import { supplyError } from '#lib/utils/computations/index.js';
import type { Node } from '#lib/types/db.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

export function getChildNodesByParentId(parent_id: string): Node[] {
	// O(1) after one snapshot build per revision; the array keeps its identity
	// while the children are unchanged, so tree rows do not re-render.
	return getChildren(loadSnapshot(), parent_id);
}

export function getParentNodes(excluded_id?: string): { name: string; id: string }[] {
	const snapshot = loadSnapshot();
	const excluded = snapshot.node_by_id.get(excluded_id ?? '');
	return snapshot.nodes.flatMap((node) => {
		if (node.id === excluded_id || (node.node_type !== 'panel' && node.node_type !== 'root')) {
			return [];
		}
		// Only panels that can supply it (a three-phase circuit needs 3P-Y).
		if (excluded && supplyError({ node: excluded, parent: node })) return [];
		// Never under its own subtree: that would cut the branch off the root.
		if (excluded_id && isWithinSubtree((id) => snapshot.node_by_id.get(id), node, excluded_id)) {
			return [];
		}
		if (node.panel_data) {
			return [{ name: node.panel_data.name || '', id: node.id }];
		}
		if (node.highest_unit_form) {
			return [{ name: node.highest_unit_form.distribution_unit || '', id: node.id }];
		}
		return [];
	});
}

/** Whether `node` sits somewhere below `ancestor_id`. */
export function isWithinSubtree(
	lookup: (id: string) => Node | undefined,
	node: Node,
	ancestor_id: string
): boolean {
	let current: Node | undefined = node;
	// Bounded: a looping parent chain in a tampered file must not spin forever.
	for (let depth = 0; current && depth < 10_000; depth += 1) {
		if (current.parent_id === ancestor_id) return true;
		current = lookup(current.parent_id ?? '');
	}
	return false;
}

/** The engine's row for `node`, merged onto the stored node; undefined until computed. */
export function loadRowOf(node: Node): PhaseLoadSchedule | undefined {
	const row = getRow(node.id);
	if (!row) return undefined;
	const cached = merged_rows.get(node.id);
	if (cached?.node === node && cached.row === row) return cached.value;
	const value = { ...node, ...row } as PhaseLoadSchedule;
	merged_rows.set(node.id, { node, row, value });
	return value;
}

/**
 * A panel's load schedule. A circuit written a moment ago shows once the engine
 * has answered (the next revision); until then it is left out.
 */
export function getComputedLoads(parent_id: string): PhaseLoadSchedule[] {
	const loads = getChildren(loadSnapshot(), parent_id).flatMap((child) => loadRowOf(child) ?? []);
	const value = reuseArrayIfEqual(computed_load_arrays.get(parent_id), loads);
	computed_load_arrays.set(parent_id, value);
	return value;
}

export function getNodeDepth(node_id: string): number {
	const snapshot = loadSnapshot();
	let depth = 1;
	let current = snapshot.node_by_id.get(node_id);
	// Bounded by the node count: a looping parent chain in a tampered file
	// would otherwise spin forever.
	while (current?.parent_id && depth <= snapshot.nodes.length) {
		depth += 1;
		current = snapshot.node_by_id.get(current.parent_id);
	}
	return depth;
}

export function getNumberOfChildren(node_id: string): number {
	const snapshot = loadSnapshot();
	let count = 0;
	const stack = [node_id];
	while (stack.length > 0) {
		const parent_id = stack.pop() as string;
		for (const child of getChildren(snapshot, parent_id)) {
			count += 1;
			if (child.node_type === 'panel') stack.push(child.id);
		}
	}
	return count;
}

export function getAllChildNodes(root_node_id: string, include_parent?: boolean): Node[] {
	const snapshot = loadSnapshot();
	const all_nodes: Node[] = [];
	const collect = (parent_id: string) => {
		const children = getChildren(snapshot, parent_id);
		all_nodes.push(...children);
		for (const child of children) collect(child.id);
	};
	collect(root_node_id);
	if (include_parent) {
		const parent_node = snapshot.node_by_id.get(root_node_id);
		if (parent_node) all_nodes.unshift(parent_node);
	}
	return all_nodes;
}

export function nextTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
