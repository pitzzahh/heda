import type { ProjectDocType, ItemDocType } from "@/db/schema";
import type { RxCollection } from "rxdb";

// we declare one static ORM-method for the collection
export type ProjectCollectionMethods = {
  countAllDocuments: () => Promise<number>;
}

// Diko pa sure kung may pwede magkaiba digdi kaya pansamantala sana
export type ItemCollectionMethods = {
  countAllDocuments: () => Promise<number>;
}

export type ProjectCollection = RxCollection<ProjectDocType, ProjectCollectionMethods>;
export type ItemCollection = RxCollection<ItemDocType, ItemCollectionMethods>;

export type MyDatabaseCollections = {
  projects: ProjectCollection,
  items: ItemCollection
}