import { addRxPlugin, createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import type { MyDatabaseCollections } from '@/types/db';

let dbInstance: RxDatabase<MyDatabaseCollections> | null = null;

/**
 * Creates a new RxDatabase instance if it doesn't already exist.
 * 
 * @param {string} [name='mydatabase'] - The name of the database.
 * @returns {Promise<RxDatabase>} The RxDatabase instance.
 */
export async function createDatabase(name: string = 'mydatabase'): Promise<RxDatabase<MyDatabaseCollections>> {
  if (dbInstance) {
    return dbInstance;
  }
  addRxPlugin(RxDBDevModePlugin);
  dbInstance = await createRxDatabase({
    name,
    storage: getRxStorageDexie()
  });
  return dbInstance;
}