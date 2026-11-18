import {
	getProject,
	initializeDatabase,
	insertNodes,
	openSession,
	setProject,
	settled
} from '../index.js';
import type { Node, Project } from '#lib/types/db.js';
import { withNodeDefaults, withProjectDefaults } from './defaults.js';
import { default_phases } from '#lib/constants.js';

export async function createProject(
	project_name: string,
	highest_unit_form: Node['highest_unit_form']
) {
	await initializeDatabase();

	try {
		// creation of root node first to be referenced in project data
		const root_node_id = crypto.randomUUID();
		const root_node = withNodeDefaults({
			id: root_node_id,
			node_type: 'root',
			// New projects are sized by the PEC 2017 tables, and new 3P-Y ones already insert
			// 400Y/230 V defaults: nothing to migrate.
			highest_unit_form: highest_unit_form && {
				...highest_unit_form,
				pec_2017_sizing: true,
				...(highest_unit_form.phase === default_phases.THREE_PHASE_WYE && {
					wye_circuit_defaults: true
				})
			},
			child_ids: []
		});
		insertNodes([root_node]);

		const project = withProjectDefaults({
			id: crypto.randomUUID(),
			root_node_id,
			project_name,
			settings: {
				is_adjustment_factor_dynamic: false
			}
		});
		setProject(project as Project);
		await settled();

		return {
			project: project as Project,
			root_node_id: root_node_id as string
		};
	} catch (err) {
		console.error(`Error in creating project: ${JSON.stringify(err)}`);
	}
}

export function updateProjectSettings(project_id: string, settings: Partial<Project['settings']>) {
	return patchProject(project_id, { settings: settings as Project['settings'] });
}

export function updateProjectTitle(id: string, project_name: string) {
	return patchProject(id, { project_name });
}

function patchProject(id: string, set: Partial<Project>): Project | undefined {
	const project = getProject();
	if (project?.id !== id) {
		console.error(`Project with ID ${id} not found`);
		return undefined;
	}
	const next = { ...project, ...set };
	setProject(next);
	return next;
}

/** Ends the session: the project and every node go. */
export function deleteProject(project_id: string) {
	if (getProject()?.id !== project_id) {
		console.error(`Project with ID ${project_id} not found`);
		return;
	}
	openSession(undefined, []);
}
