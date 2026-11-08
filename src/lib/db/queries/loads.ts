import { computed_load_array_reuse, reuseArrayIfEqual } from './cache.js';
import { loadSnapshot } from './snapshot.js';
import { computeNodeLoad, type LoadComputationContext } from './compute.js';
import { getDatabase } from '../index.js';
import type { Node } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

const EMPTY_CHILDREN: Node[] = [];

export function getChildNodesByParentId(parent_id: string): Node[] {
	// Snapshot hit is O(1) after one cached build; the old per-row find()
	// created a cursor per visible tree item and scanned the collection.
	return loadSnapshot().children_by_parent.get(parent_id) ?? EMPTY_CHILDREN;
}

export function getParentNodes(excluded_id?: string): { name: string; id: string }[] {
	return getDatabase()
		.nodes.find({
			node_type: { $in: ['panel', 'root'] },
			...(excluded_id && { id: { $ne: excluded_id } })
		})
		.fetch()
		.flatMap((doc) => {
			const data = doc as Node;
			if (data.panel_data) {
				return [{ name: data.panel_data.name || '', id: data.id }];
			}

			if (data.highest_unit_form) {
				return [{ name: data.highest_unit_form.distribution_unit || '', id: data.id }];
			}

			return [];
		});
}

export function getComputedLoads(parent_id: string): PhaseLoadSchedule[] {
	const snapshot = loadSnapshot();
	const context: LoadComputationContext = {
		children_by_parent: snapshot.children_by_parent,
		is_dynamic: snapshot.is_dynamic,
		memo: new Map()
	};

	const loads = (snapshot.children_by_parent.get(parent_id) ?? []).map((child) =>
		computeNodeLoad(child, context)
	);
	const previous = computed_load_array_reuse.get(parent_id);
	const value =
		previous && previous.is_dynamic === snapshot.is_dynamic
			? reuseArrayIfEqual(previous.value, loads)
			: loads;
	computed_load_array_reuse.set(parent_id, { is_dynamic: snapshot.is_dynamic, value });
	return value;
}

export function getNodeDepth(node_id: string): number {
	const snapshot = loadSnapshot(false);
	let depth = 1;
	let current = snapshot.node_by_id.get(node_id);

	while (current?.parent_id) {
		depth += 1;
		current = snapshot.node_by_id.get(current.parent_id);
	}

	return depth;
}

export function getNumberOfChildren(node_id: string): number {
	const snapshot = loadSnapshot(false);
	let count = 0;
	const stack = [node_id];

	while (stack.length > 0) {
		const parent_id = stack.pop() as string;
		for (const child of snapshot.children_by_parent.get(parent_id) ?? []) {
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
		const children = snapshot.children_by_parent.get(parent_id) ?? [];
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
