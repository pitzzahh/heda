// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';

vi.stubGlobal(
	'ResizeObserver',
	class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
);

import { VirtualWindow } from './virtual-window.svelte.js';

const ESTIMATE = 41;
const COUNT = 100;

function setup() {
	const scroller = document.createElement('div');
	document.body.appendChild(scroller);
	const virtual = new VirtualWindow({
		estimate_size: ESTIMATE,
		overscan: 10,
		get_item_key: (index) => `k-${index}`
	});
	virtual.use_scroll_element(scroller);
	const cleanup = virtual.mount();
	virtual.sync(COUNT);
	return { scroller, virtual, cleanup };
}

function row(index: number, height: number) {
	const el = document.createElement('div');
	el.setAttribute('data-index', String(index));
	Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
	document.body.appendChild(el);
	return el;
}

test('zero-height measurements keep the estimate instead of poisoning the cache', () => {
	const { virtual, cleanup } = setup();
	expect(virtual.total_size).toBe(COUNT * ESTIMATE);

	// display:none rows (hidden pre-mount) report offsetHeight 0.
	virtual.measure(row(5, 0));
	virtual.measure(row(6, 0));
	expect(virtual.total_size).toBe(COUNT * ESTIMATE);

	document.body.innerHTML = '';
	cleanup();
});

test('nonzero measurements still apply', () => {
	const { virtual, cleanup } = setup();
	virtual.measure(row(5, 60));
	expect(virtual.total_size).toBe(COUNT * ESTIMATE - ESTIMATE + 60);

	document.body.innerHTML = '';
	cleanup();
});
