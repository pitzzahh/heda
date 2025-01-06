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
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

let dbInstance: RxDatabase<MyDatabaseCollections> | null = null;

/**
 * Creates a new RxDatabase instance if it doesn't already exist.
 *
 * @param {string} [name='heda'] - The name of the database.
 * @param {boolean} [memory=true] - Whether to use memory storage.
 * @param {boolean} [validate_storage=false] - Whether to use validate storage.
 * @returns {Promise<RxDatabase>} The RxDatabase instance.
 */
async function createDatabase(
	name: string = 'heda',
	memory: boolean = true,
	validate_storage: boolean = false
): Promise<RxDatabase<MyDatabaseCollections>> {
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
		// @ts-ignore
		storage: memory ? getRxStorageMemory() : validate_storage ? wrappedValidateAjvStorage({
			storage: getRxStorageDexie()
		}) : getRxStorageDexie()
	});
	return dbInstance;
}

/**
 * Returns the database instance with all required collections initialized.
 *
 * @param {string} [name='heda'] - The name of the database.
 * @param {boolean} [memory=false] - Whether to use memory storage.
 * @param {boolean} [validate_storage=false] - Whether to use validate storage.
 * @returns {Promise<RxDatabase<MyDatabaseCollections>>} The initialized database instance.
 */
export async function databaseInstance(name: string = 'heda',
	memory: boolean = true,
	validate_storage: boolean = false): Promise<RxDatabase<MyDatabaseCollections>> {
	const database = await createDatabase(name, memory, validate_storage);

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
			await removeRxDatabase(name, getRxStorageDexie())
			console.error('Error adding collections:', error);
			throw new Error('Failed to add collections');
		}
	}
	return database;
}
