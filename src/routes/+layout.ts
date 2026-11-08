import { initializeDatabase } from '#lib/db/index.js';
import { preloadComputeWorker } from '#lib/workers/compute-client.js';

export const prerender = true;
export const ssr = false;

export const load = async () => {
	await initializeDatabase();
	// Spawn the worker now so a later tab switch only pays for the walk.
	preloadComputeWorker();
};
