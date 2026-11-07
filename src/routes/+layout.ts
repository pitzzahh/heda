import { initializeDatabase } from '#lib/db/index.js';

export const prerender = true;
export const ssr = false;

// Layouts derive live rows from sync queries, so the database must exist
// before first render; without this gate a fresh session 500s on /workspace.
export const load = async () => {
	await initializeDatabase();
	return {};
};
