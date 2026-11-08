import { Collection, createIndex } from '@signaldb/core';
import svelteReactivityAdapter from '@signaldb/svelte';
import { adapter } from '@pitzzahh/signaldb-adapter-tauri';
import { isTauri } from '@tauri-apps/api/core';
import { appLocalDataDir } from '@tauri-apps/api/path';
import { BaseDirectory, remove } from '@tauri-apps/plugin-fs';
import { Stronghold } from '@tauri-apps/plugin-stronghold';
import type { MyDatabaseCollections, Node, Project } from '#lib/types/db/index.js';
import { decryptGcm, encryptGcm, sessionStoreKey } from '#lib/helpers/security/index.js';
import { getSessionPassword } from './session.js';

// Session store files. Deliberately nondescript and extensionless so they do
// not advertise their contents: p = projects, n = nodes, v = vault, k = KDF salt.
const PROJECTS_FILE = 'heda-p';
const NODES_FILE = 'heda-n';
const VAULT_FILE = 'heda-v';
// Pre-rename corpses, removed best-effort on launch (see initializeDatabase).
const LEGACY_FILES = ['heda-projects.json', 'heda-nodes.json', 'heda-vault.hold', 'salt.txt'];

/** Per-session random key material in a Stronghold vault; never hardcoded, never persisted. */
async function loadPassphrase(vault_password: string, vault_path: string): Promise<string> {
	const stronghold = await Stronghold.load(vault_path, vault_password);
	let client;
	try {
		client = await stronghold.loadClient('signaldb');
	} catch {
		client = await stronghold.createClient('signaldb');
	}
	const store = client.getStore();

	const existing = await store.get('signaldb-passphrase');
	if (existing) return new TextDecoder().decode(existing);

	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const passphrase = btoa(String.fromCharCode(...bytes));
	await store.insert('signaldb-passphrase', Array.from(new TextEncoder().encode(passphrase)));
	await stronghold.save();
	return passphrase;
}

let dbInstance: MyDatabaseCollections | null = null;
let dbReady: Promise<MyDatabaseCollections> | null = null;

export class StrongholdTimeoutError extends Error {}

// Stronghold runs in Rust; when its memory protection panics (sandboxed
// kernels, locked-memory limits), the IPC promise never settles and the UI
// would hang at loading forever. Race every vault access so we always
// degrade to memory instead. Normal vault access takes milliseconds.
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new StrongholdTimeoutError(`timed out after ${ms}ms`)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function wipeSessionFiles(): Promise<void> {
	for (const file of [VAULT_FILE, PROJECTS_FILE, NODES_FILE]) {
		try {
			await remove(file, { baseDir: BaseDirectory.AppLocalData });
		} catch {
			// Already gone, nothing to wipe.
		}
	}
}

async function sessionKey(): Promise<string | null> {
	const session_secret = getSessionPassword();
	if (!session_secret) return null;
	const vault_path = `${await appLocalDataDir()}/${VAULT_FILE}`;
	try {
		return await withTimeout(loadPassphrase(session_secret, vault_path), 5000);
	} catch (err) {
		if (err instanceof StrongholdTimeoutError) {
			// Hung, not corrupt: a retry would hang too. Wipe and run on memory.
			console.error(`Stronghold hung, running on memory only: ${err}`);
			await wipeSessionFiles();
			return null;
		}
		// Corrupt vault or rotated secrets: drop the vault plus the session
		// files it protected and start over. Session data is ephemeral by design.
		console.error(`Stronghold vault unusable, resetting session store: ${err}`);
		await wipeSessionFiles();
		try {
			return await withTimeout(loadPassphrase(session_secret, vault_path), 5000);
		} catch (retry_err) {
			console.error(`Stronghold unavailable, running on memory only: ${retry_err}`);
			return null;
		}
	}
}

/**
 * Session-scoped: files wipe on launch, memory-only outside Tauri. The only
 * async part of the database; after it settles, `getDatabase()` is sync.
 */
export async function initializeDatabase(): Promise<MyDatabaseCollections> {
	if (dbInstance) return dbInstance;
	if (dbReady) return dbReady;
	dbReady = (async () => {
		const useTauri = isTauri();
		const key = useTauri ? await sessionKey() : null;
		if (useTauri) {
			for (const file of [PROJECTS_FILE, NODES_FILE, VAULT_FILE, ...LEGACY_FILES]) {
				try {
					await remove(file, { baseDir: BaseDirectory.AppLocalData });
				} catch {
					// A missing file means a fresh session. Nothing to wipe.
				}
			}
		}
		const projects = new Collection<Project>({
			name: 'projects',
			reactivity: svelteReactivityAdapter,
			persistence:
				useTauri && key
					? adapter<Project>(PROJECTS_FILE, {
							encrypt: (data) => encryptGcm(JSON.stringify(data), sessionStoreKey(key)),
							decrypt: async (encrypted) =>
								JSON.parse(await decryptGcm(encrypted, sessionStoreKey(key))) as Project[]
						})
					: undefined
		});
		const nodes = new Collection<Node>({
			name: 'nodes',
			reactivity: svelteReactivityAdapter,
			indices: [createIndex('parent_id'), createIndex('node_type'), createIndex('circuit_number')],
			persistence:
				useTauri && key
					? adapter<Node>(NODES_FILE, {
							encrypt: (data) => encryptGcm(JSON.stringify(data), sessionStoreKey(key)),
							decrypt: async (encrypted) =>
								JSON.parse(await decryptGcm(encrypted, sessionStoreKey(key))) as Node[]
						})
					: undefined
		});
		await Promise.all([projects.isReady(), nodes.isReady()]);
		dbInstance = { projects, nodes };
		// Child lookups reuse a shared snapshot, so few cursors remain per
		// visible row. Cap stays well above the default without needing 10k.
		projects.setMaxListeners(1_000);
		nodes.setMaxListeners(1_000);
		return dbInstance;
	})();
	return dbReady;
}

/** Sync access; the root layout awaits `initializeDatabase()` first. */
export function getDatabase(): MyDatabaseCollections {
	if (!dbInstance) {
		throw new Error('Database accessed before initializeDatabase() completed');
	}
	return dbInstance;
}
