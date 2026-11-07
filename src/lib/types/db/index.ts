import type * as v from 'valibot';
import type { PROJECT_DOC_SCHEMA, NODE_DOC_SCHEMA } from '#lib/validators/db.js';
import type { Collection } from '@signaldb/core';
import type { LoadType } from '#lib/types/load/index.js';

export type Project = v.InferOutput<typeof PROJECT_DOC_SCHEMA>;
export type Node = v.InferOutput<typeof NODE_DOC_SCHEMA>;

export type ProjectCollection = Collection<Project>;
export type NodeCollection = Collection<Node>;

export type MyDatabaseCollections = {
	projects: ProjectCollection;
	nodes: NodeCollection;
};

export type NodeByIdResult = Node & {
	load_description: string;
	voltage: number;
	va: number;
	ampere_frames: number;
	current: number;
	at: number;
	conductor_size: number;
	adjusted_current: number;
	conduit_size: string | number;
	egc_size: number | 'error';
};
export type ComputeCommonProperties = {
	va: number;
	current: number;
	conductor_set: number;
	conductor_qty: number;
	load_type: LoadType | 'Main';
	ambient_temp: number;
	overrided_at?: number;
	overrided_conductor_size?: number;
	overrided_egc_size?: number;
	overrided_conduit_size?: number;
};
