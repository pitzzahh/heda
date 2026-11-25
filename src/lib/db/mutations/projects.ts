import { getProject, initializeDatabase, openFile, closeSession, setProject } from '../index.js';
import type { Node, Project } from '#lib/types/db.js';

/**
 * Starts a new project as the session: a file holding only its root, opened like any
 * other. The engine completes it to the current format (PEC 2017 revision, 400Y/230 V
 * circuit defaults on 3P-Y, node and project defaults), so a new project needs no
 * migration later.
 */
export async function createProject(
	project_name: string,
	highest_unit_form: Node['highest_unit_form']
) {
	await initializeDatabase();

	try {
		const root_node_id = crypto.randomUUID();
		const { project } = await openFile({
			project: { id: crypto.randomUUID(), root_node_id, project_name, settings: {} },
			nodes: [{ id: root_node_id, node_type: 'root', highest_unit_form, child_ids: [] }]
		});
		return { project, root_node_id };
	} catch (err) {
		console.error(`Error in creating project: ${JSON.stringify(err)}`);
	}
}

/** Saves the sheet set's title block on the project (PEC 2017 1.3.2.2). */
export function updateTitleBlock(id: string, title_block: Project['title_block']) {
	return patchProject(id, { title_block });
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
	closeSession();
}
