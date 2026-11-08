// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { addNode, toast_error } = vi.hoisted(() => ({
	addNode: vi.fn(),
	toast_error: vi.fn()
}));

vi.mock('$app/state', () => ({
	page: { params: { id: 'schedule_panel-1' } }
}));

vi.mock('#lib/db/mutations/index.js', () => ({
	addNode,
	updateNode: vi.fn()
}));

vi.mock('#lib/db/queries/index.js', () => ({
	checkNodeExists: () => false
}));

vi.mock('svelte-sonner', () => ({
	toast: { warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: toast_error }
}));

vi.stubGlobal(
	'ResizeObserver',
	class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
);

vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 0));

Object.defineProperty(Element.prototype, 'animate', {
	value: () => ({ onfinish: null, cancel: () => {}, finished: Promise.resolve() }),
	configurable: true
});

import { DEFAULT_LOADS } from '#lib/constants/index.js';
import LoadFormFixture from './generic-phase-main-load-form.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

function click_button(label: string) {
	const button = [...document.querySelectorAll('button')].find((element) =>
		element.textContent?.includes(label)
	);
	button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	flushSync();
}

describe('GenericPhaseMainLoadForm', () => {
	test('renders every section through the extracted field components', () => {
		const component = mount(LoadFormFixture, { target: document.body });
		flushSync();
		const text = document.body.textContent ?? '';
		expect(text).toContain('Circuit number');
		expect(text).toContain('Ambient Temperature');
		expect(text).toContain('Terminal Temperature');
		expect(text).toContain('Length');

		click_button('Custom');
		const custom_text = document.body.textContent ?? '';
		expect(custom_text).toContain('Load description');
		expect(custom_text).toContain('Varies');
		expect(custom_text).toContain('Continuous');
		expect(custom_text).toContain('Load type');
		unmount(component);
	});

	test('selecting a default load fills the dependent inputs', async () => {
		const component = mount(LoadFormFixture, { target: document.body });
		flushSync();
		click_button('Default');

		click_button('Select a load description');
		await tick();
		flushSync();
		const first_option = document.querySelector('[role="option"]');
		expect(first_option?.textContent).toContain(DEFAULT_LOADS[0].description);
		first_option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();
		flushSync();

		const selected_trigger = [...document.querySelectorAll('button')].find((element) =>
			element.textContent?.includes(DEFAULT_LOADS[0].description)
		);
		expect(selected_trigger?.textContent).toContain(DEFAULT_LOADS[0].description);
		const continuous_box = document.querySelector('[role="checkbox"]');
		expect(continuous_box?.getAttribute('aria-checked')).toBe(String(DEFAULT_LOADS[0].continuous));
		unmount(component);
	});

	test('invalid submit reaches no mutation', async () => {
		const component = mount(LoadFormFixture, { target: document.body });
		flushSync();
		document
			.querySelector('form')
			?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		flushSync();
		expect(toast_error).toHaveBeenCalledWith('Form is invalid');
		expect(addNode).not.toHaveBeenCalled();
		unmount(component);
	});
});
