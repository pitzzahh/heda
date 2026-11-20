// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { RiserLayout } from '#lib/types/riser.js';

const empty = (width: number, height: number): RiserLayout => ({
	width,
	height,
	boxes: [],
	wires: [],
	labels: [],
	breakers: [],
	ticks: []
});

vi.mock('#lib/db/queries/index.js', () => ({
	// A large site (fitted far out) and a small panel (fitted at 100 %).
	getRiserAsync: (id: string) =>
		Promise.resolve(id === 'site' ? empty(80_000, 60_000) : empty(100, 100))
}));
vi.mock('#lib/db/queries/snapshot.js', () => ({ getSnapshotRevision: () => 0 }));
vi.mock('#lib/helpers/export/riser-svg.js', () => ({ exportRiserSvg: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let size = { width: 800, height: 600 };
let resized: () => void = () => {};
vi.stubGlobal(
	'ResizeObserver',
	class {
		constructor(callback: () => void) {
			resized = callback;
		}
		observe() {}
		disconnect() {}
	}
);
vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 0));
Object.defineProperty(HTMLElement.prototype, 'clientWidth', { get: () => size.width });
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { get: () => size.height });

import RiserDiagram from './riser-diagram.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	size = { width: 800, height: 600 };
});

const settle = async () => {
	for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
	flushSync();
};
const transform = () => document.querySelector('[transform]')?.getAttribute('transform');

describe('RiserDiagram', () => {
	test('fits each newly opened node, not only the first', async () => {
		const props = $state({ node_id: 'site' });
		const component = mount(RiserDiagram, { target: document.body, props });
		await settle();
		expect(transform()).not.toContain('scale(1)');
		props.node_id = 'panel';
		await settle();
		expect(transform()).toContain('scale(1)');
		unmount(component);
	});

	test('fits once the hidden frame gets a size', async () => {
		size = { width: 0, height: 0 };
		const component = mount(RiserDiagram, { target: document.body, props: { node_id: 'site' } });
		await settle();
		expect(transform()).toContain('scale(1)');
		size = { width: 800, height: 600 };
		resized();
		await settle();
		expect(transform()).not.toContain('scale(1)');
		unmount(component);
	});
});
