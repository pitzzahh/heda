import type { HighestUnitSchema } from '@/schema';
import { databaseInstance } from '..';
import { createId } from '@paralleldrive/cuid2';
import type { GenericPhasePanelSchema } from '@/schema/panel';
import type { PhaseMainLoadSchema } from '@/schema/load';
import type { NodeDocType } from '../schema';
import type { Project } from '@/types/project';

export async function createProject(highest_unit_form: HighestUnitSchema) {
	const database = await databaseInstance();

	try {
		// creation of root node first to be referenced in project data
		const createdRootNode = await database.nodes.insert({
			id: createId(),
			node_type: 'root',
			highest_unit_form,
			child_ids: []
		});

		const project = await database.projects.insert({
			id: createId(),
			root_node_id: createdRootNode._data.id,
			project_name: 'Untitled'
		});

		return {
			project: project as unknown as Project,
			root_node_id: createdRootNode._data.id as string
		};
	} catch (error) {
		console.log(error);
		return error;
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
	load_data?: PhaseMainLoadSchema;
	parent_id: string;
	panel_data?: GenericPhasePanelSchema;
}) {
	const database = await databaseInstance();

	try {
		const createdNode = await database.nodes.insert({
			id: createId(),
			node_type: load_data ? 'load' : 'panel',
			circuit_number: load_data
				? load_data.circuit_number
				: panel_data
					? panel_data.circuit_number
					: 0,
			panel_data,
			load_data: load_data as NodeDocType['load_data'],
			parent_id,
			child_ids: []
		});

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
			$set: {
				panel_data,
				load_data: load_data as NodeDocType['load_data']
			}
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
		const query = database.projects.findOne({ selector: { id: project_id } });
		const project = await query.exec();

		// remove all the nodes of the root node
		if (project) await removeNode(project?._data.root_node_id);

		return await query.remove();
	} catch (error) {
		console.error(error);
		return error;
	}
}
