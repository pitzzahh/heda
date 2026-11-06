import { databaseInstance } from '..';
import type { GenericPhasePanelSchema } from '#lib/types/panel';
import type { GenericPhaseMainLoadSchema } from '#lib/types/load';
import type { Project, Node } from '#lib/types/db';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
import type { FileExport } from '#lib/types/main';

// The store applies no defaults itself, so every insertion path merges these
// to keep stored documents complete.
const NODE_DEFAULTS = {
	conductor_sets: 1,
	conductor_qty: 2,
	conductor_insulation: 'THHN-Cu',
	egc_insulation: 'TW-Cu',
	conduit_type: 'PVC',
	pole: '2',
	kaic: '5',
	is_at_used_as_currents_value: false
} as const;

function withNodeDefaults<T extends { id: string }>(node: T): T & typeof NODE_DEFAULTS {
	return { ...NODE_DEFAULTS, ...node };
}

function withProjectDefaults<T extends { id: string; settings: Project['settings'] }>(
	project: T
): T {
	return {
		...project,
		settings: { is_adjustment_factor_dynamic: false, ...project.settings }
	};
}

export async function createProject(
	project_name: string,
	highest_unit_form: Node['highest_unit_form']
) {
	const database = await databaseInstance();

	try {
		// creation of root node first to be referenced in project data
		const root_node_id = crypto.randomUUID();
		const root_node = withNodeDefaults({
			id: root_node_id,
			node_type: 'root',
			highest_unit_form,
			child_ids: []
		});
		database.nodes.insert(root_node);

		const project = withProjectDefaults({
			id: crypto.randomUUID(),
			root_node_id,
			project_name,
			settings: {
				is_adjustment_factor_dynamic: false
			}
		});
		database.projects.insert(project);

		return {
			project: project as Project,
			root_node_id: root_node_id as string
		};
	} catch (err) {
		console.error(`Error in creating project: ${JSON.stringify(err)}`);
	}
}

export async function updateProjectSettings(
	project_id: string,
	settings: Partial<Project['settings']>
) {
	const database = await databaseInstance();

	try {
		database.projects.updateOne({ id: project_id }, { $set: { settings } });
		return database.projects.findOne({ id: project_id });
	} catch (error) {
		console.error(`Error in updating project settings: ${JSON.stringify(error)}`);
	}
}

export async function updateProjectTitle(id: string, project_name: string) {
	const database = await databaseInstance();

	try {
		// Use $set to update the project_name field
		database.projects.updateOne({ id }, { $set: { project_name } });
		return database.projects.findOne({ id });
	} catch (err) {
		console.error(`Error updating project title: ${JSON.stringify(err)}`);
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
	const database = await databaseInstance();

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
				await copyAndAddNodeById(child.id, created_node.id);
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

export async function updateNode({
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
	const database = await databaseInstance();

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
			await updateNodeParentById(
				{
					id,
					parent_id: existing_node.parent_id
				},
				parent_id
			);
			// // remove the node from its current parent
			// if (existing_node.parent_id) {
			// 	const current_parent = database.nodes.findOne({ id: existing_node.parent_id });
			// 	if (current_parent) {
			// 		database.nodes.updateOne(
			// 			{ id: current_parent.id },
			// 			{
			// 				$set: {
			// 					child_ids: current_parent.child_ids.filter((child_id) => child_id !== id)
			// 				}
			// 			}
			// 		);
			// 	}
			// }

			// // addd the node to the new parent
			// const new_parent = database.nodes.findOne({ id: parent_id });
			// if (new_parent) {
			// 	database.nodes.updateOne(
			// 		{ id: new_parent.id },
			// 		{ $set: { child_ids: [...new_parent.child_ids, id] } }
			// 	);
			// }
		}

		return database.nodes.findOne({ id });
	} catch (err) {
		console.error(`Error updating node: ${JSON.stringify(err)}`);
	}
}

export async function removeNode(
	id: string,
	visited: Set<string> = new Set()
): Promise<{ removed_node: PhaseLoadSchedule; children_nodes: PhaseLoadSchedule[] } | undefined> {
	if (visited.has(id)) {
		throw Error(`Circular reference detected at node ${id}`);
	}
	visited.add(id);

	const database = await databaseInstance();
	const children_nodes: PhaseLoadSchedule[] = [];

	try {
		const children = database.nodes.find({ parent_id: id }).fetch();

		for (const child of children) {
			const result = await removeNode(child.id, visited);
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

		return {
			removed_node: removed_node as unknown as PhaseLoadSchedule,
			children_nodes
		};
	} catch (error) {
		console.error(`Failed to remove node ${id}:`, error);
	}
}

export async function deleteProject(project_id: string) {
	const database = await databaseInstance();

	try {
		const project = database.projects.findOne({ id: project_id });

		if (!project) {
			throw Error(`Project with ID ${project_id} not found`);
		}

		const root_node_id = project.root_node_id;
		if (root_node_id) {
			await removeNode(root_node_id);
		}

		database.projects.removeOne({ id: project_id });
		database.projects.removeMany({}); // remove the other projects
	} catch (error) {
		console.error(`Failed to delete project ${project_id}:`, error);
	}
}

export type FieldType =
	'egc_size' | 'conductor_size' | 'at' | 'conduit_size' | 'ampere_frames' | 'length' | 'z';

const FIELD_TYPE_MAPPING: Record<FieldType, string> = {
	egc_size: 'overrided_egc_size',
	conductor_size: 'overrided_conductor_size',
	at: 'overrided_at',
	conduit_size: 'overrided_conduit_size',
	ampere_frames: 'overrided_ampere_frames',
	length: 'overrided_length',
	z: 'overrided_z'
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
		const data = unoverride && !field_data ? undefined : field_data;
		const field_to_update = FIELD_TYPE_MAPPING[field_type];

		database.nodes.updateOne({ id: node_id }, { $set: { [field_to_update]: data } });

		return database.nodes.findOne({ id: node_id });
	} catch (err) {
		console.error(`Error overriding data: ${JSON.stringify(err)}`);
	}
}

export async function updateConductorSets({ node_id, sets }: { node_id: string; sets: number }) {
	const database = await databaseInstance();

	try {
		database.nodes.updateOne({ id: node_id }, { $set: { conductor_sets: sets } });

		return database.nodes.findOne({ id: node_id });
	} catch (err) {
		console.error(`Error updating conductor sets: ${JSON.stringify(err)}`);
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
		const node_data = database.nodes.findOne({ id: node_id });

		database.nodes.updateOne(
			{ id: node_id },
			{
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
			}
		);

		return database.nodes.findOne({ id: node_id });
	} catch (err) {
		console.error(`Error updating conductor load_description: ${JSON.stringify(err)}`);
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
		database.nodes.updateOne(
			{ id: node_id },
			{
				$set: {
					...(type === 'egc' && { egc_insulation: insulation }),
					...(type === 'conductor' && { conductor_insulation: insulation })
				}
			}
		);

		return database.nodes.findOne({ id: node_id });
	} catch (err) {
		console.error(`Error changing insulation: ${JSON.stringify(err)}`);
	}
}

export async function changePole(node_id: string, pole: string) {
	const database = await databaseInstance();

	try {
		database.nodes.updateOne({ id: node_id }, { $set: { pole } });

		return database.nodes.findOne({ id: node_id });
	} catch (err) {
		console.error(`Error changing pole: ${JSON.stringify(err)}`);
	}
}

export async function useAtAsCurrentsValue(node_id: string, is_use: boolean) {
	const database = await databaseInstance();

	try {
		database.nodes.updateOne({ id: node_id }, { $set: { is_at_used_as_currents_value: is_use } });

		return database.nodes.findOne({ id: node_id });
	} catch (err) {
		console.error(`Error changing data: ${JSON.stringify(err)}`);
	}
}

export async function updateNodeParentById(
	node_to_update: {
		id: string;
		parent_id?: string;
	},
	new_parent: string
) {
	const database = await databaseInstance();

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

export async function resetData(minimumDeletedTime: number = 0) {
	void minimumDeletedTime;
	const db = await databaseInstance();
	db.projects.removeMany({});
	db.nodes.removeMany({});
}

export async function loadCurrentProject(file_export: FileExport): Promise<Project> {
	await resetData(0);
	const db = await databaseInstance();
	const { project, nodes } = file_export;

	const reconstructed_project = {
		...project,
		id: crypto.randomUUID()
	};

	const inserted_loaded_project = withProjectDefaults({ ...project });
	db.projects.insert(inserted_loaded_project);

	// Verify that the inserted project has the same project_name as the reconstructed project
	if (inserted_loaded_project.project_name !== reconstructed_project.project_name) {
		console.error('Project name mismatch after insertion');
	}

	for (const node of nodes) {
		db.nodes.insert(withNodeDefaults({ ...node }));
	}

	return inserted_loaded_project;
}
