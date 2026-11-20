import type * as v from 'valibot';
import type { PROJECT_DOC_SCHEMA, NODE_DOC_SCHEMA } from '#lib/validators/db.js';
import type {
	COMPUTE_COMMON_PROPERTIES_SCHEMA,
	LOAD_SCHEDULE_ROW_SCHEMA,
	NODE_BY_ID_RESULT_SCHEMA
} from '#lib/validators/schedule.js';

export type Project = v.InferOutput<typeof PROJECT_DOC_SCHEMA>;
export type Node = v.InferOutput<typeof NODE_DOC_SCHEMA>;

/** What the engine adds to a node: its load-schedule row, also its sidebar/header result. */
export type ComputedRow = v.InferOutput<typeof LOAD_SCHEDULE_ROW_SCHEMA>;
/** The rows an engine write recomputed, by node id (`Computed` in `crates/heda-core`). */
export type EngineComputed = {
	rows: Record<string, ComputedRow>;
};

/** The whole session (`Snapshot` in `crates/heda-core`). */
export type EngineSnapshot = EngineComputed & { project: Project | null; nodes: Node[] };

/** A file the engine opened as the session, migrated (`OpenedFile` in `crates/heda-core`). */
export type OpenedFile = EngineComputed & {
	project: Project;
	nodes: Node[];
	pec_2017_migrated: boolean;
};

export type NodeByIdResult = Node & v.InferOutput<typeof NODE_BY_ID_RESULT_SCHEMA>;

export type ComputeCommonProperties = v.InferOutput<typeof COMPUTE_COMMON_PROPERTIES_SCHEMA>;
