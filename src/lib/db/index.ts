import { addRxPlugin } from 'rxdb';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

let dbInstance: RxDatabase | null = null;

// Create a new database as a function
export async function createDatabase(name: string = 'mydatabase'): Promise<RxDatabase> {
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