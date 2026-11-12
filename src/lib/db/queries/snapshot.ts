import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { getDatabase } from '../index.js';
import { clearQueryCache, evictNodeFromCache } from './cache.js';
import type { Node } from '#lib/types/db/index.js';

export type LoadSnapshot = {
	nodes: Node[];
	node_by_id: Map<string, Node>;
	children_by_parent: Map<string, Node[]>;
	root: Node | undefined;
	is_dynamic: boolean;
};

const EMPTY_CHILDREN: Node[] = [];

let revision = 0;
let listening = false;
let cached_revision = -1;
let cached: LoadSnapshot | null = null;

// `subscribe()` tracks the current `$derived`/`$effect` scope; `bump()` wakes
// every tracked scope after any write. Outside a reactive scope it is a no-op.
let wakeTrackedScopes: (() => void) | null = null;
const subscribeToSnapshot = createSubscriber((update) => {
	wakeTrackedScopes = update;
	return () => {
		wakeTrackedScopes = null;
	};
});

function bump(): void {
	revision += 1;
	wakeTrackedScopes?.();
}

// Plain event listeners, not a cursor: a `find({}).observeChanges` cursor
// re-diffs the whole collection with a deep compare on every single write.
function ensureListening(): void {
	if (listening) return;
	listening = true;
	const { nodes, projects } = getDatabase();
	for (const collection of [nodes, projects] as const) {
		collection.on('added', bump);
		collection.on('changed', bump);
		collection.on('removed', bump);
		collection.on('persistence.received', bump);
	}
}

function buildSnapshot(previous: LoadSnapshot | null): LoadSnapshot {
	const database = getDatabase();
	// The memory arrays hold the live items; `find().fetch()` would only copy them.
	const nodes = database.nodes_memory.slice();
	const node_by_id = new Map<string, Node>();
	const children_by_parent = new Map<string, Node[]>();
	let root: Node | undefined;
	for (const node of nodes) {
		node_by_id.set(node.id, node);
		if (!root && node.node_type === 'root') root = node;
		if (!node.parent_id) continue;
		const children = children_by_parent.get(node.parent_id);
		if (children) children.push(node);
		else children_by_parent.set(node.parent_id, [node]);
	}
	for (const [parent_id, children] of children_by_parent) {
		children.sort((a, b) => (a.circuit_number ?? 0) - (b.circuit_number ?? 0));
		// Keep the old array when nothing changed so deriveds downstream settle.
		const old = previous?.children_by_parent.get(parent_id);
		if (old && sameItems(old, children)) children_by_parent.set(parent_id, old);
	}
	const snapshot: LoadSnapshot = {
		nodes,
		node_by_id,
		children_by_parent,
		root,
		is_dynamic: database.projects_memory[0]?.settings.is_adjustment_factor_dynamic ?? false
	};
	invalidateComputed(previous, snapshot);
	return snapshot;
}

/**
 * Drops cached computations for every node that changed and for its ancestors
 * (old and new parents), since a node's computed values depend only on itself
 * and its descendants. Items are replaced on every write, never mutated, so an
 * identity check finds the changed ones. Everything else stays cached, which is
 * what keeps an edit deep in a large tree from recomputing the whole project.
 */
function invalidateComputed(previous: LoadSnapshot | null, next: LoadSnapshot): void {
	if (!previous || previous.is_dynamic !== next.is_dynamic) {
		clearQueryCache();
		return;
	}
	const dirty: string[] = [];
	for (const node of next.nodes) {
		if (previous.node_by_id.get(node.id) !== node) dirty.push(node.id);
	}
	for (const node of previous.nodes) {
		if (!next.node_by_id.has(node.id)) dirty.push(node.id);
	}
	const walks = [
		{ graph: previous.node_by_id, seen: new Set<string>() },
		{ graph: next.node_by_id, seen: new Set<string>() }
	];
	for (const id of dirty) {
		// A node that did not exist before has nothing stale cached; a copy may
		// have computed it ahead of the insert, so only its ancestors go.
		const start = previous.node_by_id.has(id) ? id : next.node_by_id.get(id)?.parent_id;
		for (const { graph, seen } of walks) {
			let current = start;
			while (current && !seen.has(current)) {
				seen.add(current);
				evictNodeFromCache(current);
				current = graph.get(current)?.parent_id;
			}
		}
	}
}

function sameItems(a: Node[], b: Node[]): boolean {
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) return false;
	}
	return true;
}

/** Monotonic counter bumped by every node/project collection change. */
export function getSnapshotRevision(): number {
	ensureListening();
	subscribeToSnapshot();
	return revision;
}

/**
 * The node graph at the current revision, rebuilt at most once per revision.
 * Reading it inside a `$derived` subscribes that derived to later writes, even
 * when the cache was primed outside tracking (warmup, handler).
 */
export function loadSnapshot(): LoadSnapshot {
	ensureListening();
	subscribeToSnapshot();
	if (!cached || cached_revision !== revision) {
		cached = buildSnapshot(cached);
		cached_revision = revision;
	}
	return cached;
}

/**
 * The snapshot without subscribing the current reactive scope. Mutations read
 * through this so a write made from an effect never makes that effect depend
 * on its own write.
 */
export function peekSnapshot(): LoadSnapshot {
	return untrack(loadSnapshot);
}

export function getChildren(snapshot: LoadSnapshot, parent_id: string): Node[] {
	return snapshot.children_by_parent.get(parent_id) ?? EMPTY_CHILDREN;
}
