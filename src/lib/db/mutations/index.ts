import { databaseInstance } from '..';
import { createId } from '@paralleldrive/cuid2';
import type { GenericPhasePanelSchema } from '@/schema/panel';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { Project, Node } from '@/db/schema';

export async function createProject(highest_unit_form: Node['highest_unit_form']) {
	const database = await databaseInstance();

	try {
		// creation of root node first to be referenced in project data
		const created_root_node = await database.nodes.insert({
			id: createId(),
			node_type: 'root',
			highest_unit_form,
			child_ids: []
		});

		const project = await database.projects.insert({
			id: createId(),
			root_node_id: created_root_node._data.id,
			project_name: 'Untitled'
		});

		return {
			project: project as Project,
			root_node_id: created_root_node._data.id as string
		};
	} catch (error) {
		console.error('Error creating a project:', error);
		throw error;
	}
}

export async function updateProjectTitle(id: string, project_name: string) {
	const database = await databaseInstance();

	try {
		const query = database.projects.findOne({
			selector: {
				id
			}
		});

		// Use $set to update the project_name field
		return await query.update({
			$set: {
				project_name
			}
		});
	} catch (error) {
		console.error('Error updating project title:', error);
		throw error;
	}
}

export async function addNode({
	load_data,
	panel_data,
	parent_id
}: {
	load_data?: GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
	parent_id: string;
	panel_data?: GenericPhasePanelSchema;
}) {
	const database = await databaseInstance();

	try {
		const parent_query = database.nodes.findOne({
			selector: { id: parent_id }
		});
		const parent_node_data = await parent_query.exec();

		if (!parent_node_data) {
			throw Error(`Parent node with ID ${parent_id} not found`);
		}

		const created_node = await database.nodes.insert({
			id: createId(),
			node_type: load_data ? 'load' : 'panel',
			circuit_number: load_data?.circuit_number ?? panel_data?.circuit_number ?? 0,
			panel_data: panel_data as Node['panel_data'],
			load_data: load_data as Node['load_data'],
			parent_id,
			child_ids: []
		});

		// update parent node's child_ids
		await parent_query.update({
			$set: {
				child_ids: [...parent_node_data._data.child_ids, created_node._data.id]
			}
		});

		return created_node;
	} catch (error) {
		console.error('Error adding a node:', error);
		throw error;
	}
}

export async function copyAndAddNodeById(node_id: string, sub_parent_id?: string) {
	const database = await databaseInstance();

	try {
		const existing_node = await database.nodes
			.findOne({
				selector: {
					id: node_id
				}
			})
			.exec();

		if (!existing_node) {
			throw Error('Node not found');
		}

		// get nodes under the same parent
		const nodes_under_parent = await database.nodes
			.find({ selector: { parent_id: existing_node._data.parent_id } })
			.exec();

		// extract all the circuit numbers under the parent
		const used_numbers = nodes_under_parent.map((node) => node._data.circuit_number) as number[];
		const max_number_in_list = Math.max(...used_numbers);

		//gets the first number that is not included in the list
		let next_circuit_num = 0;
		for (let i = 1; i <= max_number_in_list; i++) {
			if (!used_numbers.includes(i)) {
				next_circuit_num = i;
				break;
			}
		}

		// if no missing number, use the next available number after the highest one
		if (next_circuit_num === 0) {
			next_circuit_num = max_number_in_list + 1;
		}

		const { load_data, panel_data, node_type, parent_id, id } = existing_node._data;
		const created_node = await database.nodes.insert({
			id: createId(),
			node_type,
			circuit_number: next_circuit_num,
			panel_data,
			load_data,
			parent_id: sub_parent_id || parent_id,
			child_ids: []
		});

		if (node_type === "panel") {
			const children = await database.nodes.find({ selector: { parent_id: id } }).exec();

			for (const child of children) {
				await copyAndAddNodeById(child._data.id, created_node._data.id);
			}
		}

		const existingParent = database.nodes.findOne({
			selector: {
				id: parent_id
			}
		});
		const parent_node_data = await existingParent.exec();

		if (parent_node_data) {
			return await existingParent.update({
				$set: {
					child_ids: [...parent_node_data._data.child_ids, created_node._data.id]
				}
			});
		}

		return created_node;
	} catch (error) {
		console.error('Error copying and adding a node:', error);
		return error;
	}
}



export async function updateNode({
	load_data,
	panel_data,
	parent_id,
	id
}: {
	load_data?: GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
	id: string;
	parent_id: string;
	panel_data?: GenericPhasePanelSchema;
}) {
	const database = await databaseInstance();

	try {
		const query = database.nodes.findOne({
			selector: { id }
		});

		const existing_node = await query.exec();
		if (!existing_node) {
			throw Error('Node not found');
		}

		const updatednode = await query.update({
			$set: {
				parent_id,
				panel_data,
				circuit_number: load_data?.circuit_number || panel_data?.circuit_number,
				load_data: load_data as Node['load_data']
			}
		});

		const is_changing_parent = parent_id !== existing_node._data.parent_id;

		if (is_changing_parent) {
			// remove the node from its current parent
			if (existing_node._data.parent_id) {
				const current_parent_query = database.nodes.findOne({
					selector: { id: existing_node._data.parent_id }
				});
				const current_parent = await current_parent_query.exec();

				if (current_parent) {
					return await current_parent_query.update({
						$set: {
							child_ids: current_parent._data.child_ids.filter((child_id) => child_id !== id)
						}
					});
				}
			}

			// addd the node to the new parent
			const new_parent_query = database.nodes.findOne({
				selector: { id: parent_id }
			});
			const new_parent = await new_parent_query.exec();

			if (new_parent) {
				return await new_parent_query.update({
					$set: {
						child_ids: [...new_parent._data.child_ids, id]
					}
				});
			}
		}

		return updatednode;
	} catch (error) {
		console.error('Error updating node:', error);
		throw error;
	}
}

export async function removeNode(id: string, visited: Set<string> = new Set()) {
	if (visited.has(id)) {
		throw Error(`Circular reference detected at node ${id}`);
	}
	visited.add(id);

	const database = await databaseInstance();

	try {
		// find and remove child nodes recursively
		const children = await database.nodes.find({ selector: { parent_id: id } }).exec();

		for (const child of children) {
			await removeNode(child._data.id, visited);
		}

		// remove the current node
		const query = database.nodes.findOne({ selector: { id } });

		console.log(`Node ${id} removed successfully`);
		return await query.remove();
	} catch (error) {
		console.error(`Failed to remove node ${id}:`, error);
		throw error;
	}
}

export async function deleteProject(project_id: string) {
	const database = await databaseInstance();

	try {
		const query = database.projects.findOne({ selector: { id: project_id } });
		const project = await query.exec();

		if (!project) {
			throw Error(`Project with ID ${project_id} not found`);
		}

		const rootNodeId = project._data.root_node_id;
		if (rootNodeId) {
			return await removeNode(rootNodeId);
		}

		return await query.remove();
	} catch (error) {
		console.error(`Failed to delete project ${project_id}:`, error);
		throw error;
	}
}
