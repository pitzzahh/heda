import { getDatabase } from '../index.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel/index.js';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load/index.js';
import type { Node } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import { evictNodeFromCache } from '../queries/index.js';
import { loadSnapshot } from '../queries/snapshot.js';
import { withNodeDefaults } from './defaults.js';

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
		const parent_node_data = database.nodes.findOne({ id: parent_id });

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
		database.nodes.insert(created_node);

		// update parent node's child_ids
		database.nodes.updateOne(
			{ id: parent_id },
			{ $set: { child_ids: [...parent_node_data.child_ids, created_node.id] } }
		);

		return created_node;
	} catch (err) {
		console.error(`Error updating project title: ${JSON.stringify(err)}`);
	}
}

export async function copyAndAddNodeById(node_id: string, sub_parent_id?: string) {
	const database = getDatabase();

	try {
		const snapshot = loadSnapshot();
		const existing_root = snapshot.node_by_id.get(node_id) as Node | undefined;

		if (!existing_root) {
			throw Error('Node not found');
		}

		const target_parent_id = sub_parent_id || (existing_root.parent_id as string | undefined);
		const siblings = target_parent_id
			? (snapshot.children_by_parent.get(target_parent_id) ?? [])
			: [];
		const used_numbers = new Set(siblings.map((node) => node.circuit_number));
		let next_circuit_num = existing_root.circuit_number ?? 1;
		while (used_numbers.has(next_circuit_num)) {
			next_circuit_num += 1;
		}

		// Collect the whole subtree first, then insert it in one batch so a
		// large panel costs one notification instead of one per node.
		const subtree: Node[] = [];
		const stack: Node[] = [existing_root];
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

		const id_map = new Map<string, string>();
		for (const node of subtree) {
			id_map.set(node.id, crypto.randomUUID());
		}

		const clones = subtree.map((node) => {
			const is_root = node.id === node_id;
			const new_parent_id = is_root
				? (target_parent_id as string)
				: (id_map.get(node.parent_id as string) as string);
			const child_ids = (snapshot.children_by_parent.get(node.id) ?? [])
				.map((child) => id_map.get(child.id) as string)
				.filter(Boolean);
			return withNodeDefaults({
				...node,
				id: id_map.get(node.id) as string,
				parent_id: new_parent_id,
				circuit_number: is_root ? next_circuit_num : node.circuit_number,
				panel_data: node.panel_data ? structuredClone(node.panel_data) : undefined,
				load_data: node.load_data ? structuredClone(node.load_data) : undefined,
				child_ids
			});
		});

		database.nodes.insertMany(clones);
		const created_root = clones[0];

		if (target_parent_id) {
			const existing_parent = database.nodes.findOne({ id: target_parent_id });
			if (existing_parent) {
				database.nodes.updateOne(
					{ id: existing_parent.id },
					{ $set: { child_ids: [...existing_parent.child_ids, created_root.id] } }
				);
			}
		}

		return created_root;
	} catch (err) {
		console.error(`Error copying and adding a node: ${JSON.stringify(err)}`);
	}
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
	const database = getDatabase();

	try {
		const existing_node = database.nodes.findOne({ id });

		if (!existing_node) {
			throw Error('Node not found');
		}

		if (whole_data) {
			database.nodes.updateOne(
				{ id },
				{
					$set: {
						...{
							...whole_data,
							panel_data: whole_data.panel_data
								? JSON.parse(JSON.stringify(whole_data.panel_data))
								: undefined,
							load_data: whole_data.load_data
								? JSON.parse(JSON.stringify(whole_data.load_data))
								: undefined
						}
					}
				}
			);
		} else {
			database.nodes.updateOne(
				{ id },
				{
					$set: {
						parent_id,
						panel_data,
						length: load_data?.length || panel_data?.length,
						circuit_number: load_data?.circuit_number || panel_data?.circuit_number,
						load_data: load_data as Node['load_data']
					}
				}
			);
		}

		const is_changing_parent = parent_id !== existing_node.parent_id;

		if (is_changing_parent) {
			updateNodeParentById(
				{
					id,
					parent_id: existing_node.parent_id
				},
				parent_id
			);
		}

		return database.nodes.findOne({ id });
	} catch (err) {
		console.error(`Error updating node: ${JSON.stringify(err)}`);
	}
}

export function removeNode(
	id: string,
	visited: Set<string> = new Set()
): { removed_node: PhaseLoadSchedule; children_nodes: PhaseLoadSchedule[] } | undefined {
	const database = getDatabase();

	try {
		const snapshot = loadSnapshot();
		const root = snapshot.node_by_id.get(id) as Node | undefined;

		if (!root) {
			throw Error(`Node with ID ${id} not found.`);
		}

		// Collect the subtree first so the delete is one bulk remove instead
		// of one removeOne per node.
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

		database.nodes.removeMany({ id: { $in: subtree.map((node) => node.id) } });
		for (const node of subtree) {
			evictNodeFromCache(node.id);
		}

		return {
			removed_node: subtree[0] as unknown as PhaseLoadSchedule,
			children_nodes: subtree.slice(1) as unknown as PhaseLoadSchedule[]
		};
	} catch (error) {
		console.error(`Failed to remove node ${id}:`, error);
	}
}

export function updateNodeParentById(
	node_to_update: {
		id: string;
		parent_id?: string;
	},
	new_parent: string
) {
	const database = getDatabase();

	const current_parent = database.nodes.findOne({ id: node_to_update.parent_id });

	// remove the id of the node to its current parent.
	if (current_parent) {
		database.nodes.updateOne(
			{ id: current_parent.id },
			{
				$set: {
					child_ids: current_parent.child_ids.filter((child_id) => child_id !== node_to_update.id)
				}
			}
		);
	}

	// find the new parent and add the node_to_update id to its child_ids
	const new_parent_data = database.nodes.findOne({ id: new_parent });
	if (new_parent_data) {
		database.nodes.updateOne(
			{ id: new_parent },
			{ $set: { child_ids: [...new_parent_data.child_ids, node_to_update.id] } }
		);
	}

	// update the node with the new parent id
	const updated_node = database.nodes.findOne({ id: node_to_update.id });
	if (updated_node) {
		database.nodes.updateOne({ id: node_to_update.id }, { $set: { parent_id: new_parent } });
		return database.nodes.findOne({ id: node_to_update.id });
	}
}
