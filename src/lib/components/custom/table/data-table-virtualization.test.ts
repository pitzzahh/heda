// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';

vi.hoisted(() => {
	const fn = () => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {}
	});
	Object.defineProperty(window, 'matchMedia', { value: fn, configurable: true });
	Object.defineProperty(globalThis, 'matchMedia', { value: fn, configurable: true });
});

vi.mock('$app/state', () => ({
	page: { params: {} }
}));

vi.mock('svelte-sonner', () => ({
	toast: { warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(), loading: vi.fn() }
}));

import Fixture from './data-table-virtualization.fixture.svelte';

const VIEWPORT_HEIGHT = 220;
const ROW_HEIGHT = 41;
const ROW_COUNT = 200;

let test_viewport_height = VIEWPORT_HEIGHT;
let clientHeightDescriptor: PropertyDescriptor | undefined;
let offsetHeightDescriptor: PropertyDescriptor | undefined;
let app: ReturnType<typeof mount> | undefined;

class FakeResizeObserver {
	static instances: FakeResizeObserver[] = [];
	targets = new Set<Element>();
	private callback: ResizeObserverCallback;

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
		FakeResizeObserver.instances.push(this);
	}

	observe(target: Element) {
		this.targets.add(target);
	}

	unobserve(target: Element) {
		this.targets.delete(target);
	}

	disconnect() {
		this.targets.clear();
	}

	trigger() {
		this.callback([], this as unknown as ResizeObserver);
	}
}

vi.stubGlobal('ResizeObserver', FakeResizeObserver);

beforeAll(() => {
	clientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
	offsetHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

	// jsdom has no layout: the DataTable scroll container is the only element
	// with `overflow-auto`, so it reports a controllable viewport while rows
	// keep a fixed height for deterministic windowing.
	Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
		configurable: true,
		get() {
			return this.classList?.contains('overflow-auto') ? test_viewport_height : 0;
		}
	});

	Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
		configurable: true,
		get() {
			return this.hasAttribute?.('data-index') ? ROW_HEIGHT : 0;
		}
	});
});

afterAll(() => {
	if (clientHeightDescriptor) {
		Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeightDescriptor);
	}
	if (offsetHeightDescriptor) {
		Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeightDescriptor);
	}
});

beforeEach(() => {
	test_viewport_height = VIEWPORT_HEIGHT;
	FakeResizeObserver.instances.length = 0;
});

afterEach(() => {
	if (app) {
		unmount(app);
		app = undefined;
	}
	document.body.innerHTML = '';
});

function mount_fixture() {
	const target = document.createElement('div');
	document.body.appendChild(target);
	app = mount(Fixture, { target });
	flushSync();
	return target;
}

async function settle() {
	await tick();
	flushSync();
}

function renderedIndexes() {
	return [...document.querySelectorAll<HTMLTableRowElement>('tbody tr[data-index]')].map((row) =>
		Number(row.dataset.index)
	);
}

test('renders only a small first slice before the viewport is measured', () => {
	test_viewport_height = 0;
	mount_fixture();

	const initial = renderedIndexes();
	expect(initial.length).toBeGreaterThan(0);
	expect(initial.length).toBeLessThan(ROW_COUNT);
	expect(initial[0]).toBe(0);
});

test('renders a window of rows and updates after scrolling', async () => {
	const target = mount_fixture();
	await settle();

	const scrollEl = target.querySelector<HTMLDivElement>('div.overflow-auto');
	expect(scrollEl).not.toBeNull();

	const initial = renderedIndexes();
	expect(initial.length).toBeGreaterThan(0);
	expect(initial.length).toBeLessThan(ROW_COUNT);
	expect(initial[0]).toBe(0);
	expect(initial.at(-1)).toBeLessThan(ROW_COUNT - 1);

	const bottomOffset = Math.max(0, ROW_COUNT * ROW_HEIGHT - VIEWPORT_HEIGHT);
	scrollEl!.scrollTop = bottomOffset;
	scrollEl!.dispatchEvent(new Event('scroll'));
	await settle();

	const scrolled = renderedIndexes();
	expect(scrolled.length).toBeGreaterThan(0);
	expect(scrolled.length).toBeLessThan(ROW_COUNT);
	expect(scrolled[0]).toBeGreaterThan(0);
	expect(scrolled.at(-1)).toBe(ROW_COUNT - 1);
});

test('keeps only the last window when a measured table becomes hidden', async () => {
	const target = mount_fixture();
	await settle();

	const scrollEl = target.querySelector<HTMLDivElement>('div.overflow-auto');
	expect(scrollEl).not.toBeNull();
	const visible = renderedIndexes();
	expect(visible.length).toBeGreaterThan(0);

	// A hidden tab reports a zero-height scroll container through the resize
	// observer; it must not fall back to rendering every row.
	test_viewport_height = 0;
	for (const observer of FakeResizeObserver.instances) {
		if (observer.targets.has(scrollEl!)) observer.trigger();
	}
	await settle();

	const hidden = renderedIndexes();
	expect(hidden.length).toBeLessThan(ROW_COUNT);
	expect(hidden).toEqual(visible);
});
