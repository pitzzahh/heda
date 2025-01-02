import { databaseInstance } from '..';
import { createId } from '@paralleldrive/cuid2';
import type { GenericPhasePanelSchema } from '@/schema/panel';
import type { GenericPhaseMainLoadSchema } from '@/schema/load';
import type { Project, Node } from '@/db/schema';
import type { PhaseLoadSchedule } from '@/types/load/one_phase';

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
			project_name: 'Untitled',
			settings: {
				is_adjustment_factor_dynamic: false
			}
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

export async function updateProjectSettings(
	project_id: string,
	settings: {
		is_adjustment_factor_dynamic: boolean;
	}
) {
	const database = await databaseInstance();

	try {
		const project = database.projects.findOne({
			selector: {
				id: project_id
			}
		});

		return await project.update({
			$set: {
				settings
			}
		});
	} catch (error) {
		console.error('Error in updating project settings:', error);
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
	parent_id,
	existing_id
}: {
	load_data?: GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
	parent_id: string;
	panel_data?: GenericPhasePanelSchema;
	existing_id?: string;
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
			id: existing_id || createId(),
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

		return created_node._data;
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
				selector: { id: node_id }
			})
			.exec();

		if (!existing_node) {
			throw Error('Node not found');
		}

		// get nodes under the same parent
		const nodes_under_parent = await database.nodes
			.find({ selector: { parent_id: sub_parent_id || existing_node._data.parent_id } })
			.exec();

		// extract all circuit numbers under the parent
		const used_numbers = nodes_under_parent.map((node) => node._data.circuit_number) as number[];

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
			conduit_type
		} = existing_node._data;
		const created_node = await database.nodes.insert({
			id: createId(),
			node_type,
			circuit_number: next_circuit_num,
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
			child_ids: []
		});

		// If the node is a panel, recursively copy its children
		if (node_type === 'panel') {
			const children = await database.nodes
				.find({ selector: { parent_id: id } })
				.sort({ circuit_number: 'asc' })
				.exec();

			// Sequentially copy children to prevent race conditions
			for (const child of children) {
				await copyAndAddNodeById(child._data.id, created_node._data.id);
			}
		}

		// Update parent node with the new child ID
		if (sub_parent_id || parent_id) {
			const existingParent = await database.nodes
				.findOne({ selector: { id: sub_parent_id || parent_id } })
				.exec();

			if (existingParent) {
				await existingParent.update({
					$set: {
						child_ids: [...existingParent._data.child_ids, created_node._data.id]
					}
				});
			}
		}

		return created_node._data;
	} catch (error) {
		console.error('Error copying and adding a node:', error);
		throw error;
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

export async function removeNode(
	id: string,
	visited: Set<string> = new Set()
): Promise<{ removed_node: PhaseLoadSchedule; children_nodes: PhaseLoadSchedule[] }> {
	if (visited.has(id)) {
		throw Error(`Circular reference detected at node ${id}`);
	}
	visited.add(id);

	const database = await databaseInstance();
	const children_nodes: PhaseLoadSchedule[] = [];

	try {
		const children = await database.nodes.find({ selector: { parent_id: id } }).exec();

		for (const child of children) {
			const { removed_node, children_nodes: grand_children } = await removeNode(
				child._data.id,
				visited
			);

			// [...children_nodes, removed_node, ...grand_children]
			children_nodes.push(removed_node, ...grand_children);
		}

		const query = database.nodes.findOne({ selector: { id } });
		const removed_node = await query.exec();

		if (!removed_node) {
			throw Error(`Node with ID ${id} not found.`);
		}

		await query.remove();

		console.log(`Node ${id} removed successfully`);
		console.log({
			removed_node: removed_node._data as unknown as PhaseLoadSchedule,
			children_nodes
		});

		return {
			removed_node: removed_node._data as unknown as PhaseLoadSchedule,
			children_nodes
		};
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

		await query.remove();
		await database.projects.find().remove(); // remove the other projects
	} catch (error) {
		console.error(`Failed to delete project ${project_id}:`, error);
		throw error;
	}
}

type FieldType = 'egc_size' | 'conductor_size' | 'at' | 'conduit_size' | 'ampere_frames';

const FIELD_TYPE_MAPPING: Record<FieldType, string> = {
	egc_size: 'overrided_egc_size',
	conductor_size: 'overrided_conductor_size',
	at: 'overrided_at',
	conduit_size: 'overrided_conduit_size',
	ampere_frames: 'overrided_ampere_frames'
};

export async function overrideField({
	node_id,
	field_data,
	unoverride = false,
	field_type
}: {
	node_id: string;
	field_data?: number;
	unoverride?: boolean;
	field_type: FieldType;
}) {
	const database = await databaseInstance();

	try {
		const query = database.nodes.findOne({
			selector: {
				id: node_id
			}
		});

		const data = unoverride && !field_data ? undefined : field_data;
		const field_to_update = FIELD_TYPE_MAPPING[field_type];

		return await query.update({
			$set: {
				[field_to_update]: data
			}
		});
	} catch (error) {
		console.error('Error overriding data:', error);
		throw error;
	}
}

export async function updateConductorSets({ node_id, sets }: { node_id: string; sets: number }) {
	const database = await databaseInstance();

	try {
		const query = database.nodes.findOne({
			selector: {
				id: node_id
			}
		});

		return await query.update({
			$set: {
				conductor_sets: sets
			}
		});
	} catch (error) {
		console.error('Error updating conductor sets:', error);
		throw error;
	}
}

export async function updateLoadDescription({
	node_id,
	load_description,
	node_type
}: {
	node_id: string;
	load_description: string;
	node_type: 'panel' | 'load';
}) {
	const database = await databaseInstance();

	try {
		const query = database.nodes.findOne({
			selector: {
				id: node_id
			}
		});

		const node_data = (await query.exec())?._data;

		const updated_node = await query.update({
			$set: {
				...(node_type === 'panel' &&
					node_data?.panel_data && {
						panel_data: {
							...node_data.panel_data,
							name: load_description
						}
					}),
				...(node_type === 'load' &&
					node_data?.load_data && {
						load_data: {
							...node_data.load_data,
							load_description
						}
					})
			}
		});

		return (
			updated_node?._data.load_data?.load_description || updated_node?._data.panel_data?.name || ''
		);
	} catch (error) {
		console.error('Error updating conductor load_description:', error);
		throw error;
	}
}

export async function changeInsulation({
	node_id,
	insulation,
	type
}: {
	node_id: string;
	insulation: string;
	type: 'egc' | 'conductor';
}) {
	const database = await databaseInstance();

	try {
		const query = database.nodes.findOne({
			selector: {
				id: node_id
			}
		});

		return await query.update({
			$set: {
				...(type === 'egc' && { egc_insulation: insulation }),
				...(type === 'conductor' && { conductor_insulation: insulation })
			}
		});
	} catch (error) {
		console.error('Error changing insulation:', error);
		throw error;
	}
}

export async function changePole(node_id: string, pole: string) {
	const database = await databaseInstance();

	try {
		const query = database.nodes.findOne({
			selector: {
				id: node_id
			}
		});

		return await query.update({
			$set: {
				pole
			}
		});
	} catch (error) {
		console.error('Error changing pole:', error);
		throw error;
	}
}
