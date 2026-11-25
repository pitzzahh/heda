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
import { loadCatalog } from '#lib/core/catalog.js';
import type {
	ComputedRow,
	EngineComputed,
	EngineEdit,
	EngineSnapshot,
	HistoryDepth,
	Node,
	OpenedFile,
	Project
} from '#lib/types/db.js';
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
let pending: Promise<void> = Promise.resolve();
let ready: Promise<void> | null = null;

let history: HistoryDepth = { undo: 0, redo: 0 };
/** Bumped whenever the session is replaced, so an answer for the one before is dropped. */
let epoch = 0;

/** Thrown for an edit or open answered after the session it was made on was replaced. */
export class SessionChangedError extends Error {
	constructor() {
		super('The project was closed or replaced before the edit finished.');
	}
}

const write_listeners = new Set<() => void>();
const edit_listeners = new Set<() => void>();
const history_listeners = new Set<() => void>();

function setHistory(next: HistoryDepth): void {
	history = next;
	for (const listener of history_listeners) listener();
}

/** Calls `listener` synchronously after every write and every engine answer; returns the unsubscribe. */
export function onSessionWrite(listener: () => void): () => void {
	write_listeners.add(listener);
	return () => write_listeners.delete(listener);
}

function notify(): void {
	for (const listener of write_listeners) listener();
}

/** Calls `listener` after every edit, undo or redo that changed the project (not on open). */
export function onEdit(listener: () => void): () => void {
	edit_listeners.add(listener);
	return () => edit_listeners.delete(listener);
}

/** Calls `listener` whenever the undo or redo depth may have changed (edits, opens, resets). */
export function onHistory(listener: () => void): () => void {
	history_listeners.add(listener);
	return () => history_listeners.delete(listener);
}

/** How many edits undo and redo can step through, as of the last engine answer. */
export function getHistory(): HistoryDepth {
	return history;
}

function apply(computed: EngineComputed): void {
	for (const [id, row] of Object.entries(computed.rows)) rows.set(id, row);
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
		await loadCatalog();
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
			closeSession();
			return;
		}
		const snapshot = await engine<EngineSnapshot>('snapshot');
		project = snapshot.project ?? undefined;
		setHistory(snapshot.history);
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

/** The engine's row for a node (its load-schedule row and sidebar/header result), once computed. */
export function getRow(id: string): ComputedRow | undefined {
	return rows.get(id);
}

/** Closes the session: no project, no nodes, no history. */
export function closeSession(): void {
	epoch += 1;
	project = undefined;
	setHistory({ undo: 0, redo: 0 });
	nodes.clear();
	rows.clear();
	notify();
	send('open', { project: null, nodes: [] });
}

/**
 * Opens a file's project and nodes as the session. The engine migrates them to the
 * current format first, so the mirror takes the documents it answers with. Until then
 * the mirror is empty. Rejects, leaving the session empty, on a file the engine refuses
 * (two nodes with one id).
 */
export function openFile(file: {
	project: Project;
	nodes: readonly Node[];
}): Promise<{ project: Project; pec_2017_migrated: boolean }> {
	const started = ++epoch;
	project = undefined;
	setHistory({ undo: 0, redo: 0 });
	nodes.clear();
	rows.clear();
	notify();
	const opened = engine<OpenedFile>('open_file', file).then((answer) => {
		if (started !== epoch) throw new SessionChangedError();
		project = answer.project;
		for (const node of answer.nodes) nodes.set(node.id, node);
		apply(answer);
		return { project: answer.project, pec_2017_migrated: answer.pec_2017_migrated };
	});
	pending = opened.then(
		() => undefined,
		() => undefined
	);
	return opened;
}

/**
 * Runs one tree edit in the engine (`add_node`, `patch_nodes`, `undo`, …: `edit.rs`)
 * and applies what it stored to the mirror once it answers, so the mirror never holds
 * a write the engine refused. Rejects with the engine's message (a supply rule, say),
 * changing nothing, or with `SessionChangedError` when the session was replaced while
 * the edit ran.
 */
export function edit(command: string, args: object = {}): Promise<EngineEdit> {
	const started = epoch;
	const applied = engine<EngineEdit>(command, args).then((edited) => {
		if (started !== epoch) throw new SessionChangedError();
		for (const id of edited.removed) {
			nodes.delete(id);
			rows.delete(id);
		}
		for (const node of edited.nodes) nodes.set(node.id, node);
		setHistory(edited.history);
		apply(edited);
		if (edited.nodes.length > 0 || edited.removed.length > 0) {
			for (const listener of edit_listeners) listener();
		}
		return edited;
	});
	pending = applied.then(
		() => undefined,
		() => undefined
	);
	return applied;
}
