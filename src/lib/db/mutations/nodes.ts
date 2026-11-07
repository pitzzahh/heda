import { getDatabase } from '../index.js';
import type { GenericPhasePanelSchema } from '#lib/types/panel/index.js';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load/index.js';
import type { Node } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import { evictNodeFromCache } from '../queries/index.js';
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

export function copyAndAddNodeById(node_id: string, sub_parent_id?: string) {
	const database = getDatabase();

	try {
		const existing_node = database.nodes.findOne({ id: node_id });

		if (!existing_node) {
			throw Error('Node not found');
		}

		// get nodes under the same parent
		const nodes_under_parent = database.nodes
			.find({ parent_id: sub_parent_id || existing_node.parent_id })
			.fetch();

		// extract all circuit numbers under the parent
		const used_numbers = nodes_under_parent.map((node) => node.circuit_number) as number[];

		// find the next available circuit number
		let next_circuit_num = 1;
		while (used_numbers.includes(next_circuit_num)) {
			next_circuit_num++;
		}

		const {
			load_data,
			panel_data,
			node_type,
			parent_id,
			id,
			overrided_at,
			conductor_qty,
			conductor_sets,
			overrided_egc_size,
			overrided_conduit_size,
			overrided_conductor_size,
			conductor_insulation,
			egc_insulation,
			conduit_type,
			length,
			overrided_ampere_frames,
			pole,
			kaic,
			is_at_used_as_currents_value,
			overrided_length,
			overrided_z
		} = existing_node;
		const created_node = withNodeDefaults({
			id: crypto.randomUUID(),
			node_type,
			circuit_number: next_circuit_num,
			length,
			panel_data,
			load_data,
			parent_id: sub_parent_id || parent_id,
			conductor_qty,
			conductor_sets,
			overrided_at,
			overrided_egc_size,
			overrided_conduit_size,
			overrided_conductor_size,
			conductor_insulation,
			egc_insulation,
			conduit_type,
			overrided_ampere_frames,
			overrided_length,
			overrided_z,
			pole,
			kaic,
			is_at_used_as_currents_value,
			child_ids: []
		});
		database.nodes.insert(created_node);

		// If the node is a panel, recursively copy its children
		if (node_type === 'panel') {
			const children = database.nodes
				.find({ parent_id: id }, { sort: { circuit_number: 1 } })
				.fetch();

			// Sequentially copy children to prevent race conditions
			for (const child of children) {
				copyAndAddNodeById(child.id, created_node.id);
			}
		}

		// Update parent node with the new child ID
		if (sub_parent_id || parent_id) {
			const existingParent = database.nodes.findOne({ id: sub_parent_id || parent_id });

			if (existingParent) {
				database.nodes.updateOne(
					{ id: existingParent.id },
					{ $set: { child_ids: [...existingParent.child_ids, created_node.id] } }
				);
			}
		}

		return created_node;
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
	if (visited.has(id)) {
		throw Error(`Circular reference detected at node ${id}`);
	}
	visited.add(id);

	const database = getDatabase();
	const children_nodes: PhaseLoadSchedule[] = [];

	try {
		const children = database.nodes.find({ parent_id: id }).fetch();

		for (const child of children) {
			const result = removeNode(child.id, visited);
			if (result) {
				const { removed_node, children_nodes: grand_children } = result;
				children_nodes.push(removed_node, ...grand_children);
			}
		}

		const removed_node = database.nodes.findOne({ id });

		if (!removed_node) {
			throw Error(`Node with ID ${id} not found.`);
		}

		database.nodes.removeOne({ id });
		evictNodeFromCache(id);

		return {
			removed_node: removed_node as unknown as PhaseLoadSchedule,
			children_nodes
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
