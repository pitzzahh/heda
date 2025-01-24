import { addRxPlugin, createRxDatabase, type RxDatabase, removeRxDatabase, type RxStorage } from 'rxdb';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import {
	getRxStorageMemory,
	type RxStorageMemory
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
 * @param {string} [instance_name='heda'] - The name of the database instance.
 * @returns {Promise<RxDatabase>} The RxDatabase instance.
 */
async function createDatabase(instance_name: string): Promise<{ dbInstance: RxDatabase<MyDatabaseCollections>, storage: RxStorage<any, any> }> {

	console.log(`createDatabase instance: ${JSON.stringify(dbInstance, null, 2)} with instance_name: ${instance_name}`);
	const storage = getRxStorageMemory();

	if (dbInstance?.name === instance_name) {
		return { dbInstance, storage };
	}
	if (dev) {
		addRxPlugin(RxDBDevModePlugin);
	}

	addRxPlugin(RxDBLeaderElectionPlugin);
	addRxPlugin(RxDBCleanupPlugin);
	addRxPlugin(RxDBUpdatePlugin);
	addRxPlugin(RxDBQueryBuilderPlugin);
	dbInstance = await createRxDatabase({
		name: instance_name,
		storage
	});
	return { dbInstance, storage };
}

/**
 * Returns the database instance with all required collections initialized.
 *
 * @param {string} [instance_name='heda'] - The name of the database instance.
 * @returns {Promise<RxDatabase<MyDatabaseCollections>>} The initialized database instance.
 */
export async function databaseInstance(instance_name: string): Promise<RxDatabase<MyDatabaseCollections>> {
	const { dbInstance: db_instance, storage } = await createDatabase(instance_name);
	console.log(`Database instance: ${JSON.stringify(db_instance, null, 2)}`);
	console.log(`Current collections: ${JSON.stringify(db_instance.collections, null, 2)}`);
	console.log(`Projects collection: ${JSON.stringify(db_instance.projects, null, 2)}`);
	console.log(`Nodes collection: ${JSON.stringify(db_instance.nodes, null, 2)}`);
	if (!db_instance.projects || !db_instance.nodes) {
		try {
			console.log('Adding collections');
			await db_instance.addCollections({
				projects: {
					schema: project_schema
				},
				nodes: {
					schema: node_schema
				}
			});
		} catch (err) {
			await removeRxDatabase(instance_name, storage)
			console.error(`Failed to add collections: ${JSON.stringify(err, null, 2)}`);
			throw new Error('Failed to add collections', { cause: err });
		}
	}
	return db_instance;
}
