import type { Project, Node } from '#lib/types/db/index.js';
import type * as v from 'valibot';
import type { HIGHEST_UNIT_SCHEMA } from '#lib/validators/index.js';

export type HighestUnitSchema = v.InferOutput<typeof HIGHEST_UNIT_SCHEMA>;

export type FileExport = {
	project: Project;
	nodes: Node[];
};

export type RecentProject = {
	id: string;
	project_name: string;
	project_path: string;
	exists: boolean;
};
