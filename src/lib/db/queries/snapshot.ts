import { getDatabase } from '../index.js';
import type { Node } from '#lib/types/db/index.js';

export type LoadSnapshot = {
	nodes: Node[];
	node_by_id: Map<string, Node>;
	children_by_parent: Map<string, Node[]>;
	is_dynamic: boolean;
};

function buildChildrenByParent(nodes: Node[], sort_by_circuit = true): Map<string, Node[]> {
	const children_by_parent = new Map<string, Node[]>();

	for (const node of nodes) {
		if (!node.parent_id) continue;
		const children = children_by_parent.get(node.parent_id);
		if (children) children.push(node);
		else children_by_parent.set(node.parent_id, [node]);
	}

	if (sort_by_circuit) {
		for (const children of children_by_parent.values()) {
			children.sort((a, b) => (a.circuit_number ?? 0) - (b.circuit_number ?? 0));
		}
	}

	return children_by_parent;
}

let revision = 0;
let observers_attached = false;
let cached_revision = -1;
let cached_sorted: LoadSnapshot | null = null;
let cached_unsorted: LoadSnapshot | null = null;

function ensureObserved(): void {
	if (observers_attached) return;
	observers_attached = true;
	const bump = () => {
		revision += 1;
	};
	const database = getDatabase();
	database.nodes.find({}).observeChanges({ added: bump, changed: bump, removed: bump }, true);
	database.projects.find({}).observeChanges({ added: bump, changed: bump, removed: bump }, true);
}

function buildSnapshot(sort_by_circuit: boolean): LoadSnapshot {
	const database = getDatabase();
	const project = database.projects.findOne({});
	const nodes = database.nodes.find({}).fetch() as Node[];
	const node_by_id = new Map(nodes.map((node) => [node.id, node]));

	return {
		nodes,
		node_by_id,
		children_by_parent: buildChildrenByParent(nodes, sort_by_circuit),
		is_dynamic: project?.settings.is_adjustment_factor_dynamic ?? false
	};
}

/** Monotonic counter bumped by every node/project collection change. */
export function getSnapshotRevision(): number {
	ensureObserved();
	return revision;
}

export function loadSnapshot(sort_by_circuit = true): LoadSnapshot {
	ensureObserved();
	if (cached_revision !== revision) {
		cached_sorted = null;
		cached_unsorted = null;
		cached_revision = revision;
	}
	if (sort_by_circuit) return (cached_sorted ??= buildSnapshot(true));
	return (cached_unsorted ??= buildSnapshot(false));
}
