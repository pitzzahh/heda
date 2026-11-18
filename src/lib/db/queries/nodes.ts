import { node_by_id_reuse, reuseIfEqual } from './cache.js';
import { getChildren, loadSnapshot } from './snapshot.js';
import { getProject, getResult } from '../index.js';
import type { Node, NodeByIdResult, Project } from '#lib/types/db.js';

export function getCurrentProject(project_id?: string): Project | undefined {
	// Reading the snapshot subscribes the caller to later writes.
	loadSnapshot();
	const project = getProject();
	return !project_id || project?.id === project_id ? project : undefined;
}

export function getAllProjects(fields?: (keyof Project)[]): Project[] {
	const project = getCurrentProject();
	if (!project) return [];
	if (!fields?.length) return [project];
	const filtered_data = {} as Project;
	for (const field of fields) {
		if (project[field] !== undefined) {
			(filtered_data as Record<typeof field, unknown>)[field] = project[field];
		}
	}
	return [filtered_data];
}

export function getRootNode(): Node | undefined {
	return loadSnapshot().root;
}

export function getNode(node_id: string): Node | undefined {
	return loadSnapshot().node_by_id.get(node_id);
}

export function checkNodeExists({
	circuit_number,
	parent_id,
	node_id
}: {
	circuit_number: number;
	parent_id: string;
	node_id?: string;
}) {
	const node = getChildren(loadSnapshot(), parent_id).find(
		(child) => child.circuit_number === circuit_number
	);

	if (node_id && node) return node_id !== node.id;

	return !!node;
}

/** A node with its engine result (sidebar, page header); null until computed. */
export function getNodeById(target_id: string): NodeByIdResult | null {
	const node = loadSnapshot().node_by_id.get(target_id);
	const result = node && getResult(target_id);
	if (!node || !result) return null;
	const value = reuseIfEqual(node_by_id_reuse.get(target_id), {
		...node,
		...result
	} as NodeByIdResult);
	node_by_id_reuse.set(target_id, value);
	return value;
}
