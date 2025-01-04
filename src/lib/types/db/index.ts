import type { Project, Node } from "@/db/schema";
import type { RxCollection } from "rxdb";
import type { LoadType } from "@/types/load";

// we declare one static ORM-method for the collection
export type ProjectCollectionMethods = {
  countAllDocuments: () => Promise<number>;
}

// Diko pa sure kung may pwede magkaiba digdi kaya pansamantala sana
export type NodeCollectionMethods = {
  countAllDocuments: () => Promise<number>;
}

export type ProjectCollection = RxCollection<Project, ProjectCollectionMethods>;
export type NodeCollection = RxCollection<Node, NodeCollectionMethods>;

export type MyDatabaseCollections = {
  projects: ProjectCollection,
  nodes: NodeCollection
}


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
}