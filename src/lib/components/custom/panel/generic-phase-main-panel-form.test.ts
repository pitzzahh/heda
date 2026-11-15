// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { addNode, toast_error } = vi.hoisted(() => ({
	addNode: vi.fn(),
	toast_error: vi.fn()
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

import PanelFormFixture from './generic-phase-main-panel-form.fixture.svelte';
import PanelForm1pFixture from './generic-phase-main-panel-form-1p.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

function disabled_trigger() {
	return document.querySelector('button[disabled]');
}

describe('GenericPhaseMainPanelForm', () => {
	test('renders every section through the extracted field components', () => {
		const component = mount(PanelFormFixture, { target: document.body });
		flushSync();
		const text = document.body.textContent ?? '';
		for (const label of [
			'Name',
			'Circuit number',
			'Terminal Temperature',
			'Type',
			'Phase',
			'Ambient Temperature',
			'Length'
		]) {
			expect(text).toContain(label);
		}
		expect(disabled_trigger()).toBeNull();
		unmount(component);
	});

	test('a 1P supply hides the type field and locks the phase trigger', () => {
		const component = mount(PanelForm1pFixture, { target: document.body });
		flushSync();
		const text = document.body.textContent ?? '';
		expect(text).toContain('Phase');
		expect(text).not.toContain('Select a panel phase type');
		expect(disabled_trigger()?.textContent).toContain('1P');
		unmount(component);
	});

	test('invalid submit reaches no mutation', async () => {
		const component = mount(PanelFormFixture, { target: document.body });
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
