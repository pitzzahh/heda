import { getDatabase, initializeDatabase } from '../index.js';
import type { Node, Project } from '#lib/types/db/index.js';
import { removeNode } from './nodes.js';
import { withNodeDefaults, withProjectDefaults } from './defaults.js';

export async function createProject(
	project_name: string,
	highest_unit_form: Node['highest_unit_form']
) {
	await initializeDatabase();
	const database = getDatabase();

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

export function updateProjectSettings(project_id: string, settings: Partial<Project['settings']>) {
	const database = getDatabase();

	try {
		database.projects.updateOne({ id: project_id }, { $set: { settings } });
		return database.projects.findOne({ id: project_id });
	} catch (error) {
		console.error(`Error in updating project settings: ${JSON.stringify(error)}`);
	}
}

export function updateProjectTitle(id: string, project_name: string) {
	const database = getDatabase();

	try {
		// Use $set to update the project_name field
		database.projects.updateOne({ id }, { $set: { project_name } });
		return database.projects.findOne({ id });
	} catch (err) {
		console.error(`Error updating project title: ${JSON.stringify(err)}`);
	}
}

export function deleteProject(project_id: string) {
	const database = getDatabase();

	try {
		const project = database.projects.findOne({ id: project_id });

		if (!project) {
			throw Error(`Project with ID ${project_id} not found`);
		}

		const root_node_id = project.root_node_id;
		if (root_node_id) {
			removeNode(root_node_id);
		}

		database.projects.removeOne({ id: project_id });
		database.projects.removeMany({}); // remove the other projects
	} catch (error) {
		console.error(`Failed to delete project ${project_id}:`, error);
	}
}
