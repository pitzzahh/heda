import type { Node } from '#lib/types/db/index.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';
import type { GeneratedWorkbook } from '#lib/helpers/export/generate.js';

type PendingTask = {
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};

let worker: Worker | null = null;
let worker_failed = false;
let next_id = 0;
const pending = new Map<number, PendingTask>();

/**
 * Spawns the compute worker early so the first tab switch never pays spawn
 * plus module load on the click. Safe to call repeatedly; no-op when the
 * worker is already up or known-broken.
 */
export function preloadComputeWorker(): void {
	getWorker();
}

function getWorker(): Worker | null {
	if (worker_failed) return null;
	if (worker) return worker;

	try {
		worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (event: MessageEvent) => {
			const { id, result, error } = event.data ?? {};
			const task = pending.get(id);
			if (!task) return;
			clearTimeout(task.timer);
			pending.delete(id);
			if (error) task.reject(new Error(String(error)));
			else task.resolve(result as VoltageDrop[]);
		};
		worker.onerror = (event) => {
			worker_failed = true;
			const failure = new Error(event.message || 'Compute worker failed');
			for (const task of pending.values()) {
				clearTimeout(task.timer);
				task.reject(failure);
			}
			pending.clear();
			worker = null;
		};
	} catch {
		worker_failed = true;
		worker = null;
		return null;
	}

	return worker;
}

/**
 * Runs voltage-drop computation in a Web Worker. Throws when no worker is
 * available so callers can fall back to the synchronous implementation.
 */
export async function generateWorkbookInWorker(
	payload: {
		type: string;
		node_id: string;
		highest_unit?: Node['highest_unit_form'];
		file_name?: string;
		nodes: Node[];
		is_dynamic: boolean;
	},
	timeout_ms = 60_000
): Promise<GeneratedWorkbook> {
	const current_worker = getWorker();
	if (!current_worker) throw new Error('Compute worker unavailable');

	const id = ++next_id;
	return new Promise<GeneratedWorkbook>((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(new Error('Compute worker timed out'));
		}, timeout_ms);

		pending.set(id, {
			resolve: resolve as (value: unknown) => void,
			reject,
			timer
		});
		current_worker.postMessage({ id, type: 'export', payload });
	});
}

export async function computeVoltageDropsInWorker(
	nodes: Node[],
	is_dynamic: boolean,
	timeout_ms = 30_000
): Promise<VoltageDrop[]> {
	const current_worker = getWorker();
	if (!current_worker) throw new Error('Compute worker unavailable');

	const id = ++next_id;
	return new Promise<VoltageDrop[]>((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(new Error('Compute worker timed out'));
		}, timeout_ms);

		pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
		current_worker.postMessage({ id, type: 'voltage-drops', nodes, is_dynamic });
	});
}
