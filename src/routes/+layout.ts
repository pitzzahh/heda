import { initializeDatabase } from '#lib/db/index.js';

export const prerender = true;
export const ssr = false;

export const load = async () => {
	await initializeDatabase();
};
