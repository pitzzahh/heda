import type * as v from 'valibot';
import type { HIGHEST_UNIT_SCHEMA } from '#lib/validators/index.js';
import type {
	FILE_EXPORT_SCHEMA,
	FILE_PROTECTION_FIELD,
	RECENT_PROJECT_SCHEMA
} from '#lib/validators/file.js';

export type HighestUnitSchema = v.InferOutput<typeof HIGHEST_UNIT_SCHEMA>;

export type FileExport = v.InferOutput<typeof FILE_EXPORT_SCHEMA>;

export type FileProtection = v.InferOutput<typeof FILE_PROTECTION_FIELD>;

export type RecentProject = v.InferOutput<typeof RECENT_PROJECT_SCHEMA>;
