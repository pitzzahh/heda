import * as v from 'valibot';
import { NODE_DOC_SCHEMA, PROJECT_DOC_SCHEMA } from './db.js';

/** How a `.heda` file is sealed: this device's key (v3) or a file password (v2). */
export const FILE_PROTECTION_FIELD = v.picklist(['device', 'password']);

/** The decrypted contents of a `.heda` file. */
export const FILE_EXPORT_SCHEMA = v.object({
	project: PROJECT_DOC_SCHEMA,
	nodes: v.array(NODE_DOC_SCHEMA)
});

/** One entry of the home screen's recent-projects list. */
export const RECENT_PROJECT_SCHEMA = v.object({
	id: v.string(),
	project_name: v.string(),
	project_path: v.string(),
	exists: v.boolean(),
	protection: v.optional(FILE_PROTECTION_FIELD)
});
