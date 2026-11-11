import type { Node } from '#lib/types/db/index.js';
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

function getWorker(): Worker | null {
	if (worker_failed) return null;
	if (worker) return worker;

	try {
		worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (event: MessageEvent) => {
			const { id, result, error } = event.data ?? {};
			const task = pending.get(id);
			if (!task) return;
			clearTimeout(task.timer);
			pending.delete(id);
			if (error) task.reject(new Error(String(error)));
			else task.resolve(result as GeneratedWorkbook);
		};
		worker.onerror = (event) => {
			worker_failed = true;
			const failure = new Error(event.message || 'Export worker failed');
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
 * Builds the workbook in a dedicated worker so ExcelJS never enters the app
 * bundle: the worker itself is spawned on the first export, and its dynamic
 * `generateWorkbook` import is fetched only when the job starts.
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
	if (!current_worker) throw new Error('Export worker unavailable');

	const id = ++next_id;
	return new Promise<GeneratedWorkbook>((resolve, reject) => {
		const timer = setTimeout(() => {
			pending.delete(id);
			reject(new Error('Export worker timed out'));
		}, timeout_ms);

		pending.set(id, {
			resolve: resolve as (value: unknown) => void,
			reject,
			timer
		});
		current_worker.postMessage({ id, type: 'export', payload });
	});
}
