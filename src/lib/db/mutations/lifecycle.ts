import { initializeDatabase, openFile, openSession } from '../index.js';
import type { Project } from '#lib/types/db.js';
import type { FileExport } from '#lib/types/main.js';
import { clearQueryCache } from '../queries/index.js';

export function resetData(minimumDeletedTime: number = 0) {
	void minimumDeletedTime;
	openSession(undefined, []);
	clearQueryCache();
}

/**
 * Opens a file's project as the session, migrated by the engine to the current format.
 * `pec_2017_migrated` is whether the file predates the current PEC 2017 revision with
 * circuits whose sizes may change. A rejected file (duplicate node ids) leaves it empty.
 */
export async function loadCurrentProject(
	file_export: FileExport
): Promise<{ project: Project; pec_2017_migrated: boolean }> {
	await initializeDatabase();
	clearQueryCache();
	// The first schedule shown reads the engine's results, which come with the answer.
	return openFile(file_export);
}
