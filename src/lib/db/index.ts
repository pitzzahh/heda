/**
 * The session store. The open project lives in the Rust engine (`crates/heda-core`,
 * reached through `engine()`); this module keeps a mirror of its documents for the
 * app's synchronous reads, plus the results the engine sent back.
 *
 * A write lands in the mirror at once (so the next read sees it) and goes to the
 * engine in order; the engine answers with the results it recomputed. `settled()`
 * resolves once every answer is in.
 */
import { isTauri } from '@tauri-apps/api/core';
import { BaseDirectory, remove } from '@tauri-apps/plugin-fs';
import { engine } from '#lib/core/api.js';
import type { ComputedResult, ComputedRow, EngineComputed, Node, Project } from '#lib/types/db.js';
import { getSessionPassword } from './session.js';

// Session files of earlier versions (node and project stores, vault and its salt),
// removed best-effort on launch: the session now lives in the app process.
const LEGACY_FILES = [
	'heda-p',
	'heda-n',
	'heda-v',
	'heda-k',
	'heda-projects.json',
	'heda-nodes.json',
	'heda-vault.hold',
	'salt.txt'
];

const nodes = new Map<string, Node>();
let project: Project | undefined;
const rows = new Map<string, ComputedRow>();
const results = new Map<string, ComputedResult>();
let pending: Promise<void> = Promise.resolve();
let ready: Promise<void> | null = null;

const write_listeners = new Set<() => void>();

/** Calls `listener` synchronously after every write and every engine answer; returns the unsubscribe. */
export function onSessionWrite(listener: () => void): () => void {
	write_listeners.add(listener);
	return () => write_listeners.delete(listener);
}

function notify(): void {
	for (const listener of write_listeners) listener();
}

function apply(computed: EngineComputed): void {
	for (const [id, row] of Object.entries(computed.rows)) rows.set(id, row);
	for (const [id, result] of Object.entries(computed.results)) results.set(id, result);
	notify();
}

/** Sends one write to the engine and applies the results it recomputed. */
function send(command: string, args: object): void {
	pending = engine<EngineComputed>(command, args).then(apply, (error: unknown) => {
		// The mirror already holds the write; only a reload would lose it.
		console.error(`Engine ${command} failed:`, error);
	});
}

/** Resolves once the engine has answered every write made so far. */
export function settled(): Promise<void> {
	return pending;
}

function hasKeepalive(): boolean {
	return getSessionPassword() !== null;
}

/**
 * Session-scoped: fresh launches start empty, same-tab reloads restore. The root
 * layout awaits this once; every read after it is synchronous.
 */
export function initializeDatabase(): Promise<void> {
	ready ??= (async () => {
		// Tests run without Tauri and start from an empty engine.
		if (!isTauri()) return;
		for (const file of LEGACY_FILES) {
			try {
				await remove(file, { baseDir: BaseDirectory.AppLocalData });
			} catch {
				// Already gone.
			}
		}
		if (!hasKeepalive()) {
			// A webview reload after the user left the project: nothing to restore.
			openSession(undefined, []);
			return;
		}
		const snapshot = await engine<EngineComputed & { project: Project | null; nodes: Node[] }>(
			'snapshot'
		);
		project = snapshot.project ?? undefined;
		for (const node of snapshot.nodes) nodes.set(node.id, node);
		apply(snapshot);
	})();
	return ready;
}

export function getProject(): Project | undefined {
	return project;
}

export function setProject(next: Project): void {
	project = next;
	notify();
	send('set_project', { project: next });
}

/** The stored nodes, in insertion order. */
export function getNodes(): Node[] {
	return [...nodes.values()];
}

export function findNode(id: string | undefined): Node | undefined {
	return id ? nodes.get(id) : undefined;
}

/** The engine's row for a node in its parent's load schedule, once computed. */
export function getRow(id: string): ComputedRow | undefined {
	return rows.get(id);
}

/** The engine's sidebar/header result for a node, once computed. */
export function getResult(id: string): ComputedResult | undefined {
	return results.get(id);
}

function assertNewIds(items: readonly Node[], existing: ReadonlyMap<string, Node>): void {
	// A tampered file must not smuggle in a second node under an existing id. Checked before any write.
	const ids = new Set<string>();
	for (const item of items) {
		if (ids.has(item.id) || existing.has(item.id)) {
			throw new Error('Item with same id already exists');
		}
		ids.add(item.id);
	}
}

/** Replaces the whole session (`undefined` and no nodes to close it). Throws, writing nothing, on a duplicate id. */
export function openSession(next_project: Project | undefined, next_nodes: readonly Node[]): void {
	assertNewIds(next_nodes, new Map());
	project = next_project;
	nodes.clear();
	rows.clear();
	results.clear();
	for (const node of next_nodes) nodes.set(node.id, node);
	notify();
	send('open', { project: next_project ?? null, nodes: next_nodes });
}

/** Inserts nodes. Throws, writing nothing, on a duplicate id. */
export function insertNodes(items: readonly Node[]): void {
	if (items.length === 0) return;
	assertNewIds(items, nodes);
	writeNodes(items);
}

/** Swaps nodes by id. Returns the ones that were found. */
export function replaceNodes(items: readonly Node[]): Node[] {
	const replaced = items.filter((item) => nodes.has(item.id));
	writeNodes(replaced);
	return replaced;
}

function writeNodes(items: readonly Node[]): void {
	if (items.length === 0) return;
	for (const item of items) nodes.set(item.id, item);
	notify();
	send('put', { nodes: items });
}

/** Removes the nodes whose id is in `ids`. */
export function removeNodes(ids: ReadonlySet<string>): void {
	if (ids.size === 0) return;
	for (const id of ids) {
		nodes.delete(id);
		rows.delete(id);
		results.delete(id);
	}
	notify();
	send('remove', { ids: [...ids] });
}
