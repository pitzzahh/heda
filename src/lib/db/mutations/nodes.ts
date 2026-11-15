import {
	getDatabase,
	insertIntoCollection,
	removeFromCollection,
	replaceInCollection
} from '../index.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel/index.js';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load/index.js';
import type { Node } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import { peekSnapshot, type LoadSnapshot } from '../queries/snapshot.js';
import { computed_loads, evictNodeFromCache } from '../queries/cache.js';
import { computeLoadsInSlices, nextTask } from '../queries/loads.js';
import { toStoredNode, withNodeDefaults } from './defaults.js';

// Work done between yields while copying, so a frame never waits on the copy.
const COPY_SLICE_MS = 8;
// Upper bound on nodes one copy may create. Past this the app runs out of
// memory and crashes with unsaved work, so the copy is refused up front.
export const MAX_COPY_NODES = 100_000;

/** The live stored node, without touching SignalDB cursors or reactivity. */
export function findNode(id: string | undefined): Node | undefined {
	if (!id) return undefined;
	return getDatabase().nodes_memory.find((node) => node.id === id);
}

/**
 * Applies `$set`-style patches to many nodes in one pass and one index
 * rebuild. Later patches for the same node merge into earlier ones.
 */
export function patchNodes(patches: [node_id: string, set: Partial<Node>][]): Node[] {
	const database = getDatabase();
	const merged = new Map<string, Node>();
	for (const [node_id, set] of patches) {
		const current = merged.get(node_id) ?? findNode(node_id);
		if (current) merged.set(node_id, { ...current, ...set });
	}
	return replaceInCollection(database.nodes, database.nodes_memory, [...merged.values()]);
}

export function patchNode(node_id: string, set: Partial<Node>): Node | undefined {
	return patchNodes([[node_id, set]])[0];
}

export function addNode({
	load_data,
	panel_data,
	parent_id,
	existing_id
}: {
	load_data?: GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
	parent_id: string;
	panel_data?: GenericPhasePanelSchema;
	existing_id?: string;
}) {
	const database = getDatabase();

	try {
		const parent_node_data = findNode(parent_id);

		if (!parent_node_data) {
			throw Error(`Parent node with ID ${parent_id} not found`);
		}

		const created_node = withNodeDefaults({
			id: existing_id || crypto.randomUUID(),
			node_type: load_data ? 'load' : 'panel',
			length: load_data?.length || panel_data?.length,
			circuit_number: load_data?.circuit_number ?? panel_data?.circuit_number ?? 0,
			panel_data: panel_data as Node['panel_data'],
			load_data: load_data as Node['load_data'],
			parent_id,
			child_ids: []
		});
		if (findNode(created_node.id)) throw Error(`Node with ID ${created_node.id} already exists`);
		insertIntoCollection(database.nodes, database.nodes_memory, [created_node]);
		patchNode(parent_id, { child_ids: [...parent_node_data.child_ids, created_node.id] });

		return created_node;
	} catch (err) {
		console.error(`Error adding node: ${JSON.stringify(err)}`);
	}
}

/**
 * Puts nodes from undo history back exactly as they were stored (overrides,
 * sets, insulation and all), in one insert. Each entry is a subtree root plus
 * its descendants. Entries whose parent no longer exists, and nodes that are
 * already back, are skipped. Returns the restored roots.
 */
export function restoreNodes(
	entries: { data: PhaseLoadSchedule | Node; children_nodes?: (PhaseLoadSchedule | Node)[] }[]
): Node[] {
	const database = getDatabase();
	const existing = new Set(database.nodes_memory.map((node) => node.id));
	const restored = new Map<string, Node>();
	const roots: Node[] = [];

	for (const { data, children_nodes = [] } of entries) {
		if (existing.has(data.id) || restored.has(data.id)) continue;
		const parent_id = data.parent_id;
		if (!parent_id || (!existing.has(parent_id) && !restored.has(parent_id))) continue;
		for (const value of [data, ...children_nodes]) {
			if (existing.has(value.id) || restored.has(value.id)) continue;
			const node = withNodeDefaults(toStoredNode(value as Node));
			restored.set(node.id, { ...node, child_ids: [] });
		}
		roots.push(restored.get(data.id) as Node);
	}
	if (restored.size === 0) return [];

	// Rebuild child links from the restored set; existing parents get the root.
	const parent_patches = new Map<string, string[]>();
	for (const node of restored.values()) {
		if (!node.parent_id) continue;
		const parent = restored.get(node.parent_id);
		if (parent) {
			parent.child_ids.push(node.id);
			continue;
		}
		const child_ids = parent_patches.get(node.parent_id) ?? [
			...(findNode(node.parent_id)?.child_ids ?? [])
		];
		if (!child_ids.includes(node.id)) child_ids.push(node.id);
		parent_patches.set(node.parent_id, child_ids);
	}

	insertIntoCollection(database.nodes, database.nodes_memory, [...restored.values()]);
	patchNodes([...parent_patches].map(([id, child_ids]) => [id, { child_ids }]));
	return roots.map((root) => restored.get(root.id) as Node);
}

// Collect the whole subtree in preorder (root first). Callers clone from one
// snapshot so a batch copy never rebuilds the graph between copies.
function collectSubtree(snapshot: LoadSnapshot, node_id: string): Node[] {
	const root = snapshot.node_by_id.get(node_id);
	if (!root) throw Error('Node not found');

	const subtree: Node[] = [];
	const stack: Node[] = [root];
	const seen = new Set<string>();
	while (stack.length > 0) {
		const current = stack.pop() as Node;
		if (seen.has(current.id)) continue;
		seen.add(current.id);
		subtree.push(current);
		const children = snapshot.children_by_parent.get(current.id) ?? [];
		for (let index = children.length - 1; index >= 0; index -= 1) {
			stack.push(children[index] as Node);
		}
	}
	return subtree;
}

function cloneSubtree(
	snapshot: LoadSnapshot,
	subtree: Node[],
	node_id: string,
	target_parent_id: string | undefined
): { clones: Node[]; root: Node } {
	const id_map = new Map<string, string>();
	for (const node of subtree) {
		id_map.set(node.id, crypto.randomUUID());
	}

	let root: Node | undefined;
	const clones = subtree.map((node) => {
		const is_root = node.id === node_id;
		const clone = withNodeDefaults({
			...node,
			id: id_map.get(node.id) as string,
			parent_id: is_root ? target_parent_id : (id_map.get(node.parent_id as string) as string),
			panel_data: node.panel_data ? structuredClone(node.panel_data) : undefined,
			load_data: node.load_data ? structuredClone(node.load_data) : undefined,
			child_ids: (snapshot.children_by_parent.get(node.id) ?? [])
				.map((child) => id_map.get(child.id) as string)
				.filter(Boolean)
		});
		if (is_root) root = clone;
		return clone;
	});

	if (!root) throw Error('Node not found');
	return { clones, root };
}

/**
 * Copies a node and its subtree `count` times as siblings.
 *
 * Cloning runs in short slices that yield to the event loop, so a copy of
 * thousands of nodes never freezes the UI; everything lands in one insert at
 * the end. Circuit numbers are picked against the siblings present at that
 * moment, so edits made while the copy runs cannot collide with it.
 */
export async function copyAndAddNodesById(
	node_id: string,
	count: number,
	sub_parent_id?: string
): Promise<Node[]> {
	const database = getDatabase();

	try {
		const copy_count = Math.floor(count);
		if (!Number.isFinite(copy_count) || copy_count <= 0) return [];

		const snapshot = peekSnapshot();
		const existing_root = snapshot.node_by_id.get(node_id);

		if (!existing_root) {
			throw Error('Node not found');
		}

		const target_parent_id = sub_parent_id || existing_root.parent_id;
		const subtree = collectSubtree(snapshot, node_id);
		if (subtree.length * copy_count > MAX_COPY_NODES) {
			throw Error(`Copy would create more than ${MAX_COPY_NODES} nodes`);
		}
		// The copy spans several tasks. If the session ends meanwhile (home,
		// reset, another file), stop and leave nothing of this project cached.
		const target_still_exists = () => !target_parent_id || !!findNode(target_parent_id);

		const clones: Node[] = [];
		const roots: Node[] = [];
		// Always yield once first, so the caller's loading state paints.
		await nextTask();
		let slice_start = performance.now();
		for (let index = 0; index < copy_count; index += 1) {
			if (performance.now() - slice_start > COPY_SLICE_MS) {
				await nextTask();
				if (!target_still_exists()) throw Error('Target parent no longer exists');
				slice_start = performance.now();
			}
			const created = cloneSubtree(snapshot, subtree, node_id, target_parent_id);
			clones.push(...created.clones);
			roots.push(created.root);
		}

		// Compute the copies before they land so the first read after the insert
		// is a cache hit, not one long block. Roots are left out: their circuit
		// numbers are only settled below.
		const root_ids = new Set(roots.map((root) => root.id));
		const clone_children = new Map<string, Node[]>();
		for (const clone of clones) {
			if (root_ids.has(clone.id) || !clone.parent_id) continue;
			const children = clone_children.get(clone.parent_id);
			if (children) children.push(clone);
			else clone_children.set(clone.parent_id, [clone]);
		}
		const descendants = clones.filter((clone) => !root_ids.has(clone.id)).reverse();
		const warmed = await computeLoadsInSlices(
			descendants,
			{ children_by_parent: clone_children, is_dynamic: snapshot.is_dynamic, memo: computed_loads },
			target_still_exists
		);
		const target_parent = findNode(target_parent_id);
		if (!warmed || (target_parent_id && !target_parent)) {
			for (const clone of descendants) evictNodeFromCache(clone.id);
			throw Error('Target parent no longer exists');
		}
		if (peekSnapshot().is_dynamic !== snapshot.is_dynamic) {
			for (const clone of descendants) evictNodeFromCache(clone.id);
		}

		const used_numbers = new Set(
			database.nodes_memory
				.filter((node) => target_parent_id && node.parent_id === target_parent_id)
				.map((node) => node.circuit_number)
		);
		let next_circuit_num = existing_root.circuit_number ?? 1;
		for (const root of roots) {
			while (used_numbers.has(next_circuit_num)) next_circuit_num += 1;
			used_numbers.add(next_circuit_num);
			// Roots are fresh objects that are not in the store yet.
			root.circuit_number = next_circuit_num;
			next_circuit_num += 1;
		}

		insertIntoCollection(database.nodes, database.nodes_memory, clones);
		if (target_parent) {
			patchNode(target_parent.id, {
				child_ids: [...target_parent.child_ids, ...roots.map((root) => root.id)]
			});
		}

		return roots;
	} catch (err) {
		console.error(`Error copying and adding nodes: ${JSON.stringify(err)}`);
		return [];
	}
}

export async function copyAndAddNodeById(node_id: string, sub_parent_id?: string) {
	const [created_root] = await copyAndAddNodesById(node_id, 1, sub_parent_id);
	return created_root;
}

export function updateNode({
	load_data,
	panel_data,
	parent_id,
	id,
	whole_data
}: {
	load_data?: GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
	id: string;
	parent_id: string;
	panel_data?: GenericPhasePanelSchema;
	whole_data?: Node;
}) {
	try {
		const existing_node = findNode(id);

		if (!existing_node) {
			throw Error('Node not found');
		}

		const set: Partial<Node> = whole_data
			? {
					...toStoredNode(whole_data),
					panel_data: whole_data.panel_data ? structuredClone(whole_data.panel_data) : undefined,
					load_data: whole_data.load_data ? structuredClone(whole_data.load_data) : undefined,
					// Undo restores the node's own fields; its children are tracked separately.
					child_ids: existing_node.child_ids
				}
			: {
					parent_id,
					panel_data: panel_data as Node['panel_data'],
					length: load_data?.length || panel_data?.length,
					circuit_number: load_data?.circuit_number || panel_data?.circuit_number,
					load_data: load_data as Node['load_data']
				};

		const patches: [string, Partial<Node>][] = [[id, set]];
		if (parent_id !== existing_node.parent_id) {
			patches.push(...reparentPatches(id, existing_node.parent_id, parent_id));
		}
		patchNodes(patches);

		return findNode(id);
	} catch (err) {
		console.error(`Error updating node: ${JSON.stringify(err)}`);
	}
}

function reparentPatches(
	id: string,
	old_parent_id: string | undefined,
	new_parent_id: string
): [string, Partial<Node>][] {
	const patches: [string, Partial<Node>][] = [];
	const old_parent = findNode(old_parent_id);
	if (old_parent) {
		patches.push([
			old_parent.id,
			{ child_ids: old_parent.child_ids.filter((child_id) => child_id !== id) }
		]);
	}
	const new_parent = findNode(new_parent_id);
	if (new_parent) {
		// Same parent: start from the filtered list above so the id is not doubled.
		const base =
			new_parent.id === old_parent?.id
				? new_parent.child_ids.filter((child_id) => child_id !== id)
				: new_parent.child_ids;
		patches.push([new_parent.id, { child_ids: [...base, id] }]);
	}
	if (findNode(id)) patches.push([id, { parent_id: new_parent_id }]);
	return patches;
}

function collectForRemoval(snapshot: LoadSnapshot, root: Node, removed: Set<string>): Node[] {
	const subtree: Node[] = [];
	const stack: Node[] = [root];
	while (stack.length > 0) {
		const current = stack.pop() as Node;
		if (removed.has(current.id)) continue;
		removed.add(current.id);
		subtree.push(current);
		const children = snapshot.children_by_parent.get(current.id) ?? [];
		for (let index = children.length - 1; index >= 0; index -= 1) {
			stack.push(children[index] as Node);
		}
	}
	return subtree;
}

/** Drops the removed roots from the child lists of parents that stay. */
function detachFromParents(roots: Node[], removed: Set<string>): void {
	const patches = new Map<string, string[]>();
	for (const root of roots) {
		if (!root.parent_id || removed.has(root.parent_id)) continue;
		const child_ids = patches.get(root.parent_id) ?? findNode(root.parent_id)?.child_ids;
		if (!child_ids) continue;
		patches.set(
			root.parent_id,
			child_ids.filter((child_id) => child_id !== root.id)
		);
	}
	patchNodes([...patches].map(([id, child_ids]) => [id, { child_ids }]));
}

export function removeNode(
	id: string,
	visited: Set<string> = new Set()
): { removed_node: PhaseLoadSchedule; children_nodes: PhaseLoadSchedule[] } | undefined {
	const database = getDatabase();

	try {
		const snapshot = peekSnapshot();
		const root = snapshot.node_by_id.get(id);

		if (!root) {
			throw Error(`Node with ID ${id} not found.`);
		}

		// Collect the subtree first so the delete is one pass over the collection
		// instead of one removeOne per node.
		const subtree: Node[] = [];
		const stack: Node[] = [root];
		const seen = new Set(visited);
		while (stack.length > 0) {
			const current = stack.pop() as Node;
			if (seen.has(current.id)) {
				throw Error(`Circular reference detected at node ${current.id}`);
			}
			seen.add(current.id);
			subtree.push(current);
			const children = snapshot.children_by_parent.get(current.id) ?? [];
			for (let index = children.length - 1; index >= 0; index -= 1) {
				stack.push(children[index] as Node);
			}
		}

		const removed = new Set(subtree.map((node) => node.id));
		removeFromCollection(database.nodes, database.nodes_memory, removed);
		detachFromParents([root], removed);

		return {
			removed_node: subtree[0] as unknown as PhaseLoadSchedule,
			children_nodes: subtree.slice(1) as unknown as PhaseLoadSchedule[]
		};
	} catch (error) {
		console.error(`Failed to remove node ${id}:`, error);
	}
}

/**
 * Removes many subtrees in one pass, sharing a single snapshot.
 * Roots nested inside an earlier root are skipped instead of failing.
 */
export function removeNodesById(
	ids: string[]
): { removed_node: PhaseLoadSchedule; children_nodes: PhaseLoadSchedule[] }[] {
	const database = getDatabase();

	try {
		const snapshot = peekSnapshot();
		const removed = new Set<string>();
		const roots: Node[] = [];
		const results: {
			removed_node: PhaseLoadSchedule;
			children_nodes: PhaseLoadSchedule[];
		}[] = [];

		for (const id of ids) {
			const root = snapshot.node_by_id.get(id);
			if (!root || removed.has(id)) continue;

			const subtree = collectForRemoval(snapshot, root, removed);
			roots.push(root);
			results.push({
				removed_node: subtree[0] as unknown as PhaseLoadSchedule,
				children_nodes: subtree.slice(1) as unknown as PhaseLoadSchedule[]
			});
		}

		if (removed.size > 0) {
			removeFromCollection(database.nodes, database.nodes_memory, removed);
			detachFromParents(roots, removed);
		}

		return results;
	} catch (error) {
		console.error('Failed to remove nodes:', error);
		return [];
	}
}

export function updateNodeParentById(
	node_to_update: {
		id: string;
		parent_id?: string;
	},
	new_parent: string
) {
	patchNodes(reparentPatches(node_to_update.id, node_to_update.parent_id, new_parent));
	return findNode(node_to_update.id);
}
