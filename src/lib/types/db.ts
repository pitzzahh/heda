import type * as v from 'valibot';
import type { PROJECT_DOC_SCHEMA, NODE_DOC_SCHEMA } from '#lib/validators/db.js';
import type {
	COMPUTE_COMMON_PROPERTIES_SCHEMA,
	NODE_BY_ID_RESULT_SCHEMA
} from '#lib/validators/schedule.js';
import type { Collection } from '@signaldb/core';

export type Project = v.InferOutput<typeof PROJECT_DOC_SCHEMA>;
export type Node = v.InferOutput<typeof NODE_DOC_SCHEMA>;

export type ProjectCollection = Collection<Project>;
export type NodeCollection = Collection<Node>;

export type MyDatabaseCollections = {
	projects: ProjectCollection;
	nodes: NodeCollection;
};

export type NodeByIdResult = Node & v.InferOutput<typeof NODE_BY_ID_RESULT_SCHEMA>;

export type ComputeCommonProperties = v.InferOutput<typeof COMPUTE_COMMON_PROPERTIES_SCHEMA>;
