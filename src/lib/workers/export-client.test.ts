import { afterEach, describe, expect, test, vi } from 'vitest';

class FakeWorker {
	static instances: FakeWorker[] = [];
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: ErrorEvent) => void) | null = null;
	posted: { id: number }[] = [];
	terminated = false;
	constructor() {
		FakeWorker.instances.push(this);
	}
	postMessage(message: { id: number }) {
		this.posted.push(message);
	}
	terminate() {
		this.terminated = true;
	}
}

vi.stubGlobal('Worker', FakeWorker);

const { generateWorkbookInWorker } = await import('./export-client.js');

const payload = { type: 'xlsx', node_id: 'n1', nodes: [], is_dynamic: false };

afterEach(() => {
	vi.useRealTimers();
});

describe('generateWorkbookInWorker', () => {
	test('spawns a fresh worker after the previous one crashed', async () => {
		const first = generateWorkbookInWorker(payload);
		const crashed = FakeWorker.instances.at(-1)!;
		crashed.onerror?.({ message: 'boom' } as ErrorEvent);
		await expect(first).rejects.toThrow('boom');
		expect(crashed.terminated).toBe(true);

		const second = generateWorkbookInWorker(payload);
		const fresh = FakeWorker.instances.at(-1)!;
		expect(fresh).not.toBe(crashed);
		fresh.onmessage?.({ data: { id: fresh.posted[0].id, result: 'ok' } } as MessageEvent);
		await expect(second).resolves.toBe('ok');
	});

	test('drops a hung worker when a job times out', async () => {
		vi.useFakeTimers();
		const job = generateWorkbookInWorker(payload, 1_000);
		const hung = FakeWorker.instances.at(-1)!;
		vi.advanceTimersByTime(1_000);
		await expect(job).rejects.toThrow('timed out');
		expect(hung.terminated).toBe(true);

		void generateWorkbookInWorker(payload, 1_000).catch(() => undefined);
		expect(FakeWorker.instances.at(-1)).not.toBe(hung);
	});
});
