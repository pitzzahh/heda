import { computeNodeLoad, type LoadComputationContext } from './compute.js';
import type { Node } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

export function buildChildrenByParent(nodes: Node[]): Map<string, Node[]> {
	const children_by_parent = new Map<string, Node[]>();
	for (const node of nodes) {
		if (!node.parent_id) continue;
		const children = children_by_parent.get(node.parent_id);
		if (children) children.push(node);
		else children_by_parent.set(node.parent_id, [node]);
	}
	for (const children of children_by_parent.values()) {
		children.sort((a, b) => (a.circuit_number ?? 0) - (b.circuit_number ?? 0));
	}
	return children_by_parent;
}

export function getComputedLoadsFromNodes(
	nodes: Node[],
	parent_id: string,
	is_dynamic: boolean
): PhaseLoadSchedule[] {
	const children_by_parent = buildChildrenByParent(nodes);
	const context: LoadComputationContext = { children_by_parent, is_dynamic, memo: new Map() };
	return (children_by_parent.get(parent_id) ?? []).map((child) => computeNodeLoad(child, context));
}

export function getNodeDepthFromNodes(nodes: Node[], node_id: string): number {
	const node_by_id = new Map(nodes.map((node) => [node.id, node]));
	let depth = 1;
	let current = node_by_id.get(node_id);
	while (current?.parent_id) {
		depth += 1;
		current = node_by_id.get(current.parent_id);
	}
	return depth;
}

export function getNodeByIdFromNodes(nodes: Node[], node_id: string): Node | undefined {
	return nodes.find((node) => node.id === node_id);
}
