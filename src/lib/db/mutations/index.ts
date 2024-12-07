import type { HighestUnitSchema } from '@/schema';
import { databaseInstance } from '..';
import { createId } from '@paralleldrive/cuid2';
import type { GenericPhasePanelSchema } from '@/schema/panel';
import type { PhaseMainLoadSchema } from '@/schema/load';
import type { NodeDocType } from '../schema';

export async function createProject(highest_unit_form: HighestUnitSchema) {
	const database = await databaseInstance();

	try {
		const project = await database.projects.insert({
			id: createId(),
			highest_unit_form,
			tree: []
		});

		return project;
	} catch (error) {
		console.log(error);
		return error;
	}
}

export async function updateProjectTitle(id: string, project_title: string) {
	const database = await databaseInstance();

	try {
		const query = database.projects.findOne({
			selector: {
				id
			}
		});

		const updatedProject = await query.update({
			project_title
		});

		return updatedProject;
	} catch (error) {
		console.log(error);
		return error;
	}
}

export async function addNode({
	load_data,
	panel_data,
	parent_id,
	is_parent_root_node
}: {
	load_data?: PhaseMainLoadSchema;
	parent_id: string;
	panel_data?: GenericPhasePanelSchema;
	is_parent_root_node?: boolean;
}) {
	const database = await databaseInstance();

	try {
		const createdNode = await database.nodes.insert({
			id: createId(),
			node_type: load_data ? 'load' : 'panel',
			panel_data,
			load_data: load_data as NodeDocType['load_data'],
			parent_id,
			child_ids: []
		});

		if (is_parent_root_node && panel_data) {
			const existingRootParent = database.projects.findOne({
				selector: {
					id: parent_id
				}
			});
			const rootNodeData = await existingRootParent.exec();

			if (rootNodeData) {
				await existingRootParent.update({
					tree: [...rootNodeData._data.tree, createdNode._data.id]
				});
			}
		} else {
			const existingParent = database.nodes.findOne({
				selector: {
					id: parent_id
				}
			});
			const parentNodeData = await existingParent.exec();

			if (parentNodeData) {
				await existingParent.update({
					child_ids: [...parentNodeData._data.child_ids, createdNode._data.id]
				});
			}
		}

		return createdNode;
	} catch (error) {
		console.log(error);
		return error;
	}
}

export async function updateNode({
	load_data,
	panel_data,
	id
}: {
	load_data?: PhaseMainLoadSchema;
	id: string;
	panel_data?: GenericPhasePanelSchema;
}) {
	const database = await databaseInstance();

	try {
		const query = database.nodes.findOne({
			selector: {
				id
			}
		});

		const updatedNode = await query.update({
			panel_data,
			load_data: load_data as NodeDocType['load_data']
		});

		return updatedNode;
	} catch (error) {
		console.log(error);
		return error;
	}
}

export async function removeNode(id: string) {
	const database = await databaseInstance();

	try {
		// child nodes of the target node
		const children = await database.nodes.find({ selector: { parent_id: id } }).exec();

		for (const child of children) {
			await removeNode(child.id);
		}

		const query = database.nodes.findOne({ selector: { id } });
		const removedNode = await query.remove();

		return removedNode;
	} catch (error) {
		console.error(error);
		return error;
	}
}

export async function deleteProject(project_id: string) {
	const database = await databaseInstance();

	try {
		// remove all the nodes of the root node
		await removeNode(project_id);

		const query = database.projects.findOne({ selector: { id: project_id } });
		const removedProjectId = await query.remove();

		return removedProjectId;
	} catch (error) {
		console.error(error);
		return error;
	}
}
