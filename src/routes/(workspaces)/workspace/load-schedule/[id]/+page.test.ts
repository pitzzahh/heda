// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/state', () => ({
	page: { params: { id: 'panel_node1' } }
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

vi.mock('#lib/hooks/project-state.svelte.js', () => ({
	getProjectState: () => ({ loaded: true })
}));

vi.mock('#lib/db/queries/index.js', () => ({
	getNodeById: (id: string) => ({
		id,
		node_type: 'panel',
		parent_id: null,
		panel_data: { name: 'LP-A' }
	}),
	getNode: () => undefined,
	getRootNode: () => ({ highest_unit_form: { phase: 'one_phase' } }),
	getComputedLoads: () => [{ id: 'load-1' }],
	getComputedVoltageDrops: () => [{ id: 'vd-1' }]
}));

vi.mock('#lib/components/custom/table/index.js', async () => ({
	DataTable: (await import('./datatable.stub.svelte')).default
}));

vi.mock('#lib/components/custom/table/one-phase-load-cols/one-phase-main-or-wye-cols.js', () => ({
	onePhaseMainOrWyeCols: () => []
}));

vi.mock('#lib/components/custom/table/voltage-drop-cols/voltage-drop-cols.js', () => ({
	voltageDropColumns: () => []
}));

import LoadSchedulePage from './+page.svelte';

vi.stubGlobal(
	'ResizeObserver',
	class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
);

afterEach(() => {
	document.body.innerHTML = '';
});

function stub_rows(footer: string) {
	return document.querySelector(`[data-testid="datatable-stub"][data-footer="${footer}"]`);
}

function click_trigger(label: string) {
	const triggers = [...document.querySelectorAll('[data-slot="tabs-trigger"]')];
	const trigger = triggers.find((element) => element.textContent?.includes(label));
	trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	flushSync();
}

describe('load schedule page', () => {
	test('both tables stay populated when switching tabs', () => {
		const component = mount(LoadSchedulePage, { target: document.body });
		flushSync();
		expect(stub_rows('true')?.getAttribute('data-rows')).toBe('1');
		expect(stub_rows('false')?.getAttribute('data-rows')).toBe('0');

		click_trigger('Voltage Drop');
		expect(stub_rows('true')?.getAttribute('data-rows')).toBe('1');
		expect(stub_rows('false')?.getAttribute('data-rows')).toBe('1');

		click_trigger('Load Schedule');
		expect(stub_rows('true')?.getAttribute('data-rows')).toBe('1');
		expect(stub_rows('false')?.getAttribute('data-rows')).toBe('1');
		unmount(component);
	});
});
