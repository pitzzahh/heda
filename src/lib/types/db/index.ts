import type { ProjectDocType, NodeDocType } from "@/db/schema";
import type { RxCollection } from "rxdb";

// we declare one static ORM-method for the collection
export type ProjectCollectionMethods = {
  countAllDocuments: () => Promise<number>;
}

// Diko pa sure kung may pwede magkaiba digdi kaya pansamantala sana
export type NodeCollectionMethods = {
  countAllDocuments: () => Promise<number>;
}

export type ProjectCollection = RxCollection<ProjectDocType, ProjectCollectionMethods>;
export type NodeCollection = RxCollection<NodeDocType, NodeCollectionMethods>;

export type MyDatabaseCollections = {
  projects: ProjectCollection,
  items: NodeCollection
}