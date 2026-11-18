import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { getNodes, onSessionWrite } from '../index.js';
import type { Node } from '#lib/types/db.js';

export type LoadSnapshot = {
	nodes: Node[];
	node_by_id: Map<string, Node>;
	children_by_parent: Map<string, Node[]>;
	root: Node | undefined;
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

// Every write, and every engine answer, bumps the revision synchronously.
function ensureListening(): void {
	if (listening) return;
	listening = true;
	onSessionWrite(bump);
}

function buildSnapshot(previous: LoadSnapshot | null): LoadSnapshot {
	const nodes = getNodes();
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
	return {
		nodes,
		node_by_id,
		children_by_parent,
		root
	};
}

function sameItems(a: Node[], b: Node[]): boolean {
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) return false;
	}
	return true;
}

/** Monotonic counter bumped by every write and every engine answer. */
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
