import { addRxPlugin, createRxDatabase, type RxDatabase, removeRxDatabase } from 'rxdb';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import {
	getRxStorageMemory
} from 'rxdb/plugins/storage-memory';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import type { MyDatabaseCollections } from '@/types/db';
import { project_schema, node_schema } from '@/db/schema/index.js';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBCleanupPlugin } from 'rxdb/plugins/cleanup';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { dev } from '$app/environment';

let dbInstance: RxDatabase<MyDatabaseCollections> | null = null;

/**
 * Creates a new RxDatabase instance if it doesn't already exist.
 *
 * @param {string} [name='heda'] - The name of the database.
 * @returns {Promise<RxDatabase>} The RxDatabase instance.
 */
async function createDatabase(name: string = 'heda'): Promise<RxDatabase<MyDatabaseCollections>> {
	if (dbInstance) {
		return dbInstance;
	}
	if (dev) {
		addRxPlugin(RxDBDevModePlugin);
	}

	addRxPlugin(RxDBLeaderElectionPlugin);
	addRxPlugin(RxDBCleanupPlugin);
	addRxPlugin(RxDBUpdatePlugin);
	addRxPlugin(RxDBQueryBuilderPlugin);
	dbInstance = await createRxDatabase({
		name,
		storage: getRxStorageMemory()
	});
	return dbInstance;
}

/**
 * Returns the database instance with all required collections initialized.
 *
 * @param {string} [name='heda'] - The name of the database.
 * @returns {Promise<RxDatabase<MyDatabaseCollections>>} The initialized database instance.
 */
export async function databaseInstance(name: string = 'heda'): Promise<RxDatabase<MyDatabaseCollections>> {
	const database = await createDatabase(name);

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
			console.log(`Added collections: ${JSON.stringify(added_collections_result)}`);
		} catch (err) {
			await removeRxDatabase(name, getRxStorageDexie())
			console.error(`Failed to add collections: ${JSON.stringify(err)}`);
			throw new Error('Failed to add collections');
		}
	}
	return database;
}
