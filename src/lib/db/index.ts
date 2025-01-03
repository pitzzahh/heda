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
import { dev } from '$app/environment';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

let dbInstance: RxDatabase<MyDatabaseCollections> | null = null;

/**
 * Creates a new RxDatabase instance if it doesn't already exist.
 *
 * @param {string} [name='mydatabase'] - The name of the database.
 * @returns {Promise<RxDatabase>} The RxDatabase instance.
 */
async function createDatabase(
	name: string = 'mydatabase',
	memory: boolean = true,
	validate_storage: boolean = false
): Promise<RxDatabase<MyDatabaseCollections>> {
	if (dbInstance) {
		return dbInstance;
	}
	if (dev) {
		addRxPlugin(RxDBDevModePlugin);
	}

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
 * @returns {Promise<RxDatabase<MyDatabaseCollections>>} The initialized database instance.
 */
export async function databaseInstance(): Promise<RxDatabase<MyDatabaseCollections>> {
	const database = await createDatabase('heda', true);

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
			await removeRxDatabase("mydatabase", getRxStorageDexie())

			console.error('Error adding collections:', error);
			throw new Error('Failed to add collections');
		}
	}

	return database;
}
