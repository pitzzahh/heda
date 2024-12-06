import { addRxPlugin, createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import type { MyDatabaseCollections } from '@/types/db';
import { project_schema, node_schema } from '@/db/schema/index.js';

let dbInstance: RxDatabase<MyDatabaseCollections> | null = null;

/**
 * Creates a new RxDatabase instance if it doesn't already exist.
 *
 * @param {string} [name='mydatabase'] - The name of the database.
 * @returns {Promise<RxDatabase>} The RxDatabase instance.
 */
async function createDatabase(
	name: string = 'mydatabase'
): Promise<RxDatabase<MyDatabaseCollections>> {
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

/**
 * Returns the database instance with all required collections initialized.
 *
 * @returns {Promise<RxDatabase<MyDatabaseCollections>>} The initialized database instance.
 */
export async function databaseInstance(): Promise<RxDatabase<MyDatabaseCollections>> {
	const database = await createDatabase();

	if (!database.projects || !database.nodes) {
		try {
			const added_collections_result = await database.addCollections({
				projects: {
					schema: project_schema
				},
				nodes: {
					schema: node_schema
				}
			});
			console.log('Collections added:', added_collections_result);
		} catch (error) {
			console.error('Error adding collections:', error);
			throw new Error('Failed to add collections');
		}
	}

	return database;
}
