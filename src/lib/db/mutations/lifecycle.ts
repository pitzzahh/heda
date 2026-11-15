import {
	clearCollection,
	getDatabase,
	initializeDatabase,
	insertIntoCollection
} from '../index.js';
import type { Project } from '#lib/types/db/index.js';
import type { FileExport } from '#lib/types/main/index.js';
import { clearQueryCache, warmComputedLoads } from '../queries/index.js';
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

	// Nodes first, in one pass and one index rebuild (`insertMany` scans the
	// array per item). A file with duplicate ids throws here, before the
	// project exists, so a rejected file leaves an empty session behind.
	insertIntoCollection(
		db.nodes,
		db.nodes_memory,
		nodes.map((node) => withNodeDefaults({ ...node }))
	);

	const inserted_loaded_project = withProjectDefaults({ ...project });
	db.projects.insert(inserted_loaded_project);

	// Verify that the inserted project has the same project_name as the reconstructed project
	if (inserted_loaded_project.project_name !== reconstructed_project.project_name) {
		console.error('Project name mismatch after insertion');
	}

	// Background: the first schedule opened after loading reads a warm cache.
	void warmComputedLoads();

	return inserted_loaded_project;
}
