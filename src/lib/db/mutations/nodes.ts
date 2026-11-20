/**
 * Tree edits. Each one is an engine command (`crates/heda-core/src/edit.rs`): the
 * engine checks it against the supply rules, plans every document it touches, stores
 * it as one undoable step and answers with what it wrote, which `edit()` applies to the
 * mirror. A refused edit changes nothing and comes back as its message.
 */
import { edit, findNode } from '../index.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel.js';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load.js';
import type { Node } from '#lib/types/db.js';

export { findNode };

/** A refused edit's message, as the engine wrote it. */
export function editError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** The circuit form's fields, as the engine's `add_node` and `update_node` take them. */
type CircuitInput = {
	load_data?: GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
	panel_data?: GenericPhasePanelSchema;
};

/** One node's change: top-level fields to set (`undefined` removes one), and fields to set inside an object field. */
export type NodePatch = {
	id: string;
	set?: Partial<Node>;
	merge?: Partial<Record<'panel_data' | 'load_data' | 'highest_unit_form', object>>;
};

/** JSON drops `undefined`, so a field to remove travels as `null`. */
function withNulls(fields: object | undefined): object | undefined {
	return (
		fields && Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value ?? null]))
	);
}

/** Applies `patches` in one undoable step; returns the nodes that changed. */
export async function patchNodes(patches: NodePatch[]): Promise<Node[]> {
	try {
		const { nodes } = await edit('patch_nodes', {
			patches: patches.map(({ id, set, merge }) => ({
				id,
				set: withNulls(set),
				merge: merge && Object.fromEntries(Object.entries(merge).map(([k, v]) => [k, withNulls(v)]))
			}))
		});
		const ids = new Set(patches.map((patch) => patch.id));
		return nodes.filter((node) => ids.has(node.id));
	} catch (error) {
		console.error('Error patching nodes:', error);
		return [];
	}
}

/** Sets fields of one node; returns it as stored, unchanged when the patch changed nothing. */
export async function patchNode(node_id: string, set: Partial<Node>): Promise<Node | undefined> {
	await patchNodes([{ id: node_id, set }]);
	return findNode(node_id);
}

/** A new panel, or a load when `load_data` is given, under `parent_id`. */
export async function addNode({
	parent_id,
	...input
}: CircuitInput & { parent_id: string }): Promise<{ node?: Node; error?: string }> {
	try {
		const { id } = await edit('add_node', { parent_id, node: input });
		return { node: findNode(id) };
	} catch (error) {
		return { error: editError(error) };
	}
}

/** A circuit edited in its form, possibly under another panel (`parent_id`). */
export async function updateNode({
	id,
	parent_id,
	...input
}: CircuitInput & { id: string; parent_id: string }): Promise<{ node?: Node; error?: string }> {
	try {
		await edit('update_node', { id, parent_id, node: input });
		return { node: findNode(id) };
	} catch (error) {
		return { error: editError(error) };
	}
}

/**
 * Moves a node under another panel (sidebar drag and drop). A circuit number already
 * used on the new panel is replaced with the next free one, reported as `renumbered_to`.
 */
export async function updateNodeParentById(
	node_id: string,
	parent_id: string
): Promise<{ node?: Node; error?: string; renumbered_to?: number }> {
	try {
		const { renumbered_to } = await edit('move_node', { id: node_id, parent_id });
		return { node: findNode(node_id), renumbered_to };
	} catch (error) {
		return { error: editError(error) };
	}
}

/** Removes each node with its subtree in one undoable step; returns how many nodes went. */
export async function removeNodesById(ids: string[]): Promise<number> {
	try {
		const { removed } = await edit('remove_nodes', { ids });
		return removed.length;
	} catch (error) {
		console.error('Failed to remove nodes:', error);
		return 0;
	}
}

/** Removes a node with its subtree; returns how many nodes went. */
export function removeNode(id: string): Promise<number> {
	return removeNodesById([id]);
}

/**
 * Copies a node and its subtree `count` times as siblings (or under `sub_parent_id`),
 * in one undoable step. The engine refuses a copy past `catalog.max_copy_nodes`.
 */
export async function copyAndAddNodesById(
	node_id: string,
	count: number,
	sub_parent_id?: string
): Promise<{ nodes: Node[]; error?: string }> {
	try {
		const { ids = [] } = await edit('copy_nodes', {
			id: node_id,
			count,
			parent_id: sub_parent_id
		});
		return { nodes: ids.flatMap((id) => findNode(id) ?? []) };
	} catch (error) {
		return { nodes: [], error: editError(error) };
	}
}

export async function copyAndAddNodeById(node_id: string, sub_parent_id?: string) {
	const { nodes } = await copyAndAddNodesById(node_id, 1, sub_parent_id);
	return nodes[0];
}

/** Takes back the last edit; answers whether anything changed. */
export function undoEdit(): Promise<boolean> {
	return historyStep('undo');
}

/** Makes the last undone edit again; answers whether anything changed. */
export function redoEdit(): Promise<boolean> {
	return historyStep('redo');
}

// Keyboard shortcuts fire these without awaiting: a refusal or a session swap mid-step is
// logged here, never left as an unhandled rejection.
async function historyStep(command: 'undo' | 'redo'): Promise<boolean> {
	try {
		const { nodes, removed } = await edit(command);
		return nodes.length > 0 || removed.length > 0;
	} catch (error) {
		console.error(`Failed to ${command}:`, error);
		return false;
	}
}
