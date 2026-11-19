import { initializeDatabase, openSession, settled } from '../index.js';
import type { Project } from '#lib/types/db.js';
import type { FileExport } from '#lib/types/main.js';
import { clearQueryCache } from '../queries/index.js';
import { migrateFileExport } from '#lib/helpers/file/migrations.js';
import { withNodeDefaults, withProjectDefaults } from './defaults.js';

export function resetData(minimumDeletedTime: number = 0) {
	void minimumDeletedTime;
	openSession(undefined, []);
	clearQueryCache();
}

/** Opens a file's project as the session. A rejected file (duplicate node ids) leaves it empty. */
export async function loadCurrentProject(file_export: FileExport): Promise<Project> {
	await initializeDatabase();
	const { project, nodes } = migrateFileExport(file_export);
	const loaded_project = withProjectDefaults({ ...project });
	clearQueryCache();
	try {
		openSession(
			loaded_project,
			nodes.map((node) => withNodeDefaults({ ...node }))
		);
	} catch (error) {
		openSession(undefined, []);
		throw error;
	}
	// The first schedule shown reads the engine's results, not an empty table.
	await settled();
	return loaded_project;
}
