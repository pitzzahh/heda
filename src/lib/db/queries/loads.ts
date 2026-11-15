import { computed_load_arrays, computed_loads, reuseArrayIfEqual } from './cache.js';
import {
	getChildren,
	getSnapshotRevision,
	loadSnapshot,
	peekSnapshot,
	type LoadSnapshot
} from './snapshot.js';
import { computeNodeLoad, type LoadComputationContext } from './compute.js';
import type { Node } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

export function getChildNodesByParentId(parent_id: string): Node[] {
	// O(1) after one snapshot build per revision; the array keeps its identity
	// while the children are unchanged, so tree rows do not re-render.
	return getChildren(loadSnapshot(), parent_id);
}

export function getParentNodes(excluded_id?: string): { name: string; id: string }[] {
	return loadSnapshot().nodes.flatMap((node) => {
		if (node.id === excluded_id || (node.node_type !== 'panel' && node.node_type !== 'root')) {
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

/** The shared, revision-surviving computation context for the live snapshot. */
export function liveComputationContext(snapshot: LoadSnapshot): LoadComputationContext {
	return {
		children_by_parent: snapshot.children_by_parent,
		is_dynamic: snapshot.is_dynamic,
		memo: computed_loads
	};
}

export function getComputedLoads(parent_id: string): PhaseLoadSchedule[] {
	const snapshot = loadSnapshot();
	const context = liveComputationContext(snapshot);
	const loads = getChildren(snapshot, parent_id).map((child) => computeNodeLoad(child, context));
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

// Work done per task before yielding back to the event loop.
const SLICE_MS = 8;

export function nextTask(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Computes `nodes` into `context.memo` a few milliseconds at a time. Pass
 * children before their parents so every call is O(children) instead of a
 * whole-subtree recursion that cannot be split. Stops (returning false) as
 * soon as `keep_going` says the graph it was given is no longer current.
 */
export async function computeLoadsInSlices(
	nodes: Node[],
	context: LoadComputationContext,
	keep_going: () => boolean = () => true
): Promise<boolean> {
	let slice_start = performance.now();
	for (const node of nodes) {
		if (performance.now() - slice_start > SLICE_MS) {
			await nextTask();
			if (!keep_going()) return false;
			slice_start = performance.now();
		}
		computeNodeLoad(node, context);
	}
	return true;
}

/**
 * Fills the load cache for the whole project in the background, so the first
 * look at a large schedule (the root above all) is a cache read rather than a
 * long block. Gives up on any write; later reads compute what they need.
 */
export async function warmComputedLoads(): Promise<void> {
	await nextTask();
	const revision = getSnapshotRevision();
	const snapshot = peekSnapshot();
	if (!snapshot.root) return;
	const preorder: Node[] = [];
	const stack = [...getChildren(snapshot, snapshot.root.id)];
	while (stack.length > 0) {
		const node = stack.pop() as Node;
		preorder.push(node);
		stack.push(...getChildren(snapshot, node.id));
	}
	await computeLoadsInSlices(
		preorder.reverse(),
		liveComputationContext(snapshot),
		() => getSnapshotRevision() === revision
	);
}
