import { clearCollection, getDatabase, initializeDatabase } from '../index.js';
import type { Project } from '#lib/types/db/index.js';
import type { FileExport } from '#lib/types/main/index.js';
import { clearQueryCache } from '../queries/index.js';
import { migrateFileExport } from '#lib/helpers/file/migrations.js';
import { withNodeDefaults, withProjectDefaults } from './defaults.js';

export function resetData(minimumDeletedTime: number = 0) {
	void minimumDeletedTime;
	const db = getDatabase();
	clearCollection(db.projects, db.projects_memory);
	clearCollection(db.nodes, db.nodes_memory);
	clearQueryCache();
}

export async function loadCurrentProject(file_export: FileExport): Promise<Project> {
	await initializeDatabase();
	resetData(0);
	const db = getDatabase();
	const { project, nodes } = migrateFileExport(file_export);

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

	// Bulk-insert so SignalDB emits one change notification instead of one per
	// node; per-node inserts froze the UI on large projects.
	db.nodes.insertMany(nodes.map((node) => withNodeDefaults({ ...node })));

	return inserted_loaded_project;
}
