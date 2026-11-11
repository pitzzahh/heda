import { Collection, createIndex } from '@signaldb/core';
import type { BaseItem, Changeset, PersistenceAdapter } from '@signaldb/core';
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
// Web-only (non-Tauri) keepalive: tab-scoped `sessionStorage` snapshot so a
// reload in the same window restores the in-memory collections. Cleared when
// the tab closes; Tauri uses its encrypted files instead.
const SESSION_DATA_KEY = 'heda-session-data';

function sessionStorageOrNull(): Storage | null {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		return null;
	}
}

function hasKeepalive(): boolean {
	return getSessionPassword() !== null;
}

let webSnapshotListenerAttached = false;

function attachWebSnapshotSave(): void {
	if (webSnapshotListenerAttached) return;
	webSnapshotListenerAttached = true;
	const save = () => {
		if (!dbInstance) return;
		try {
			const payload = JSON.stringify({
				projects: dbInstance.projects.find().fetch(),
				nodes: dbInstance.nodes.find().fetch()
			});
			sessionStorageOrNull()?.setItem(SESSION_DATA_KEY, payload);
		} catch {
			// Best-effort: quota or private mode just skips the next reload restore.
		}
	};
	try {
		window.addEventListener('pagehide', save);
	} catch {
		// Node tests have no window.
	}
}

function restoreWebSession(): void {
	if (!hasKeepalive()) return;
	let raw: string | null = null;
	try {
		raw = sessionStorageOrNull()?.getItem(SESSION_DATA_KEY) ?? null;
	} catch {
		return;
	}
	if (!raw || !dbInstance) return;
	try {
		const parsed = JSON.parse(raw) as { projects?: Project[]; nodes?: Node[] };
		if (parsed.projects?.length) dbInstance.projects.insertMany(parsed.projects);
		if (parsed.nodes?.length) dbInstance.nodes.insertMany(parsed.nodes);
	} catch {
		// Corrupt snapshot: stay on the empty session instead of crashing.
	}
}

/** Drop the web keepalive snapshot (called when the user ends the session). */
export function clearSessionSnapshot(): void {
	try {
		sessionStorageOrNull()?.removeItem(SESSION_DATA_KEY);
	} catch {
		// Storage unavailable; nothing to clear.
	}
}

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

// Long enough to fold a multi-step edit into one write, short enough that a
// same-tab reload rarely misses the last edit.
const SESSION_SAVE_DELAY_MS = 100;

/**
 * Makes a burst of mutations cost one session-file write.
 *
 * SignalDB calls `save` with a copy of the collection taken at the first
 * change, then calls it again for every change that arrived meanwhile, and the
 * adapter rewrites the whole file each time. Waiting briefly and writing the
 * live memory array catches the rest of the burst; the follow-up save is
 * skipped when the written copy already holds every changed item. Items are
 * replaced (never mutated) on update, so identity tells which version was
 * written.
 */
export function coalesceSaves<T extends BaseItem<string>>(
	inner: PersistenceAdapter<T, string>,
	memory: T[],
	delay_ms = SESSION_SAVE_DELAY_MS
): PersistenceAdapter<T, string> {
	let written: Set<T> | null = null;
	return {
		...inner,
		async save(_items, changes) {
			if (written && isWritten(changes, written)) return;
			await new Promise((resolve) => setTimeout(resolve, delay_ms));
			const items = memory.slice();
			await inner.save(items, changes);
			written = new Set(items);
		}
	};
}

function isWritten<T>(changes: Changeset<T>, written: Set<T>): boolean {
	return (
		changes.added.every((item) => written.has(item)) &&
		changes.modified.every((item) => written.has(item)) &&
		changes.removed.every((item) => !written.has(item))
	);
}

/**
 * Session-scoped: fresh launches start empty, same-tab reloads restore.
 * The only async part of the database; after it settles, `getDatabase()` is sync.
 */
export async function initializeDatabase(): Promise<MyDatabaseCollections> {
	if (dbInstance) return dbInstance;
	if (dbReady) return dbReady;
	dbReady = (async () => {
		const useTauri = isTauri();
		const sameSession = hasKeepalive();
		const key = useTauri ? await sessionKey() : null;
		if (useTauri) {
			for (const file of LEGACY_FILES) {
				try {
					await remove(file, { baseDir: BaseDirectory.AppLocalData });
				} catch {
					// A missing file means a fresh session. Nothing to wipe.
				}
			}
			if (!sameSession) {
				for (const file of [PROJECTS_FILE, NODES_FILE, VAULT_FILE]) {
					try {
						await remove(file, { baseDir: BaseDirectory.AppLocalData });
					} catch {
						// A missing file means a fresh session. Nothing to wipe.
					}
				}
			}
		}
		// The collections default to a plain array as their memory adapter; keep
		// typed references to those arrays so `clearCollection` can drop every
		// item in one pass without the O(n²) `removeMany({})` path.
		const projects_memory: Project[] = [];
		const projects = new Collection<Project>({
			name: 'projects',
			memory: projects_memory,
			reactivity: svelteReactivityAdapter,
			persistence:
				useTauri && key
					? coalesceSaves(
							adapter<Project>(PROJECTS_FILE, {
								encrypt: (data) => encryptGcm(JSON.stringify(data), sessionStoreKey(key)),
								decrypt: async (encrypted) =>
									JSON.parse(await decryptGcm(encrypted, sessionStoreKey(key))) as Project[]
							}),
							projects_memory
						)
					: undefined
		});
		const nodes_memory: Node[] = [];
		const nodes = new Collection<Node>({
			name: 'nodes',
			memory: nodes_memory,
			reactivity: svelteReactivityAdapter,
			indices: [createIndex('parent_id'), createIndex('node_type'), createIndex('circuit_number')],
			persistence:
				useTauri && key
					? coalesceSaves(
							adapter<Node>(NODES_FILE, {
								encrypt: (data) => encryptGcm(JSON.stringify(data), sessionStoreKey(key)),
								decrypt: async (encrypted) =>
									JSON.parse(await decryptGcm(encrypted, sessionStoreKey(key))) as Node[]
							}),
							nodes_memory
						)
					: undefined
		});
		await Promise.all([projects.isReady(), nodes.isReady()]);
		dbInstance = { projects, nodes, projects_memory, nodes_memory };
		// Child lookups reuse a shared snapshot, so few cursors remain per
		// visible row. Cap stays well above the default without needing 10k.
		projects.setMaxListeners(1_000);
		nodes.setMaxListeners(1_000);
		if (!useTauri) {
			restoreWebSession();
			attachWebSnapshotSave();
		}
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

/**
 * Drops every item from a collection in one shot.
 *
 * `Collection.removeMany({})` is O(n²) — it rescans the array and rebuilds the
 * indices once per item — and emits one `removed` event per item. On a large
 * project that froze the UI for seconds when leaving the workspace. The memory
 * array is supplied by the caller (it is the adapter the collection was built
 * with), so clearing it directly is O(1); `batch` then rebuilds the indices in
 * one pass and a single `removed` event invalidates observers, cursors and the
 * persistence adapter together.
 */
export function clearCollection<T extends BaseItem<string>>(
	collection: Collection<T, string>,
	memory: T[]
): void {
	if (memory.length === 0) return;
	const last_item = memory[memory.length - 1];
	memory.length = 0;
	collection.batch(() => {});
	collection.emit('removed', last_item);
}

/**
 * Removes the items whose id is in `ids` in one pass over the memory array.
 *
 * `removeMany` costs a scan and an index rebuild per removed item, and every
 * per-item `removed` event makes each open cursor requery. Cursors requery on
 * any `removed` event regardless of the item, so one event after the filter
 * invalidates them, the snapshot cache and the persistence adapter together.
 */
export function removeFromCollection<T extends BaseItem<string>>(
	collection: Collection<T, string>,
	memory: T[],
	ids: ReadonlySet<string>
): void {
	let kept = 0;
	let last_removed: T | undefined;
	for (const item of memory) {
		if (ids.has(item.id)) last_removed = item;
		else memory[kept++] = item;
	}
	if (!last_removed) return;
	memory.length = kept;
	collection.batch(() => {});
	collection.emit('removed', last_removed);
}
