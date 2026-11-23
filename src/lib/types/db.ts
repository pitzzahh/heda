import type * as v from 'valibot';
import type { PROJECT_DOC_SCHEMA, NODE_DOC_SCHEMA } from '#lib/validators/db.js';
import type {
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

/** How many edits undo and redo can step through (`HistoryDepth` in `crates/heda-core`). */
export type HistoryDepth = { undo: number; redo: number };

/** The whole session (`Snapshot` in `crates/heda-core`). */
export type EngineSnapshot = EngineComputed & {
	project: Project | null;
	nodes: Node[];
	history: HistoryDepth;
};

/**
 * What an engine edit, undo or redo stored (`Edited` in `crates/heda-core`): the
 * documents written, the ids removed, the rows recomputed, the history after it, and
 * what the command adds (a created `id`, copied `ids`, a move's `renumbered_to`).
 */
export type EngineEdit = EngineComputed & {
	nodes: Node[];
	removed: string[];
	history: HistoryDepth;
	id?: string;
	ids?: string[];
	renumbered_to?: number;
};

/** A file the engine opened as the session, migrated (`OpenedFile` in `crates/heda-core`). */
export type OpenedFile = EngineComputed & {
	project: Project;
	nodes: Node[];
	pec_2017_migrated: boolean;
};

export type NodeByIdResult = Node & v.InferOutput<typeof NODE_BY_ID_RESULT_SCHEMA>;
