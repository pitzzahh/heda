// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
	getComputedVoltageDrops: () => [{ id: 'vd-1' }],
	getComputedVoltageDropsAsync: () => Promise.resolve([{ id: 'vd-1' }]),
	getSnapshotRevision: () => 0
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
import { seen_columns } from './datatable.stub.svelte';

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
	vi.useRealTimers();
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

async function settle_warm() {
	// Effect schedules a setTimeout(0) before the async worker call resolves.
	await vi.advanceTimersByTimeAsync(0);
	await Promise.resolve();
	await Promise.resolve();
	flushSync();
	await Promise.resolve();
	flushSync();
}

async function settle_mount() {
	// Mount deferral runs in a macrotask after activation+ready.
	await vi.advanceTimersByTimeAsync(0);
	flushSync();
}

describe('load schedule page', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	test('warms voltage drops in the background without mounting the hidden table', async () => {
		const component = mount(LoadSchedulePage, { target: document.body });
		flushSync();
		expect(stub_rows('true')?.getAttribute('data-rows')).toBe('1');
		expect(stub_rows('false')).toBeNull();

		await settle_warm();
		// Data is warm but the heavy table stays unmounted until the user visits
		// the tab, so background work never blocks the load schedule.
		expect(stub_rows('false')).toBeNull();
		unmount(component);
	});

	test('both tables stay populated when switching tabs', async () => {
		const component = mount(LoadSchedulePage, { target: document.body });
		flushSync();
		await settle_warm();
		expect(stub_rows('true')?.getAttribute('data-rows')).toBe('1');
		// Not mounted until visited.
		expect(stub_rows('false')).toBeNull();

		click_trigger('Voltage Drop');
		// Activation + ready mounts the table after the deferred paint tick.
		await settle_mount();
		expect(stub_rows('true')?.getAttribute('data-rows')).toBe('1');
		expect(stub_rows('false')?.getAttribute('data-rows')).toBe('1');

		click_trigger('Load Schedule');
		expect(stub_rows('true')?.getAttribute('data-rows')).toBe('1');
		expect(stub_rows('false')?.getAttribute('data-rows')).toBe('1');
		unmount(component);
	});

	test('column definitions keep identity across tab switches', async () => {
		seen_columns.length = 0;
		const component = mount(LoadSchedulePage, { target: document.body });
		flushSync();
		await settle_warm();

		click_trigger('Voltage Drop');
		await settle_mount();
		click_trigger('Load Schedule');
		flushSync();

		for (const footer of [true, false]) {
			const entries = seen_columns.filter((entry) => entry.footer === footer);
			expect(entries.length).toBeGreaterThan(0);
			for (const entry of entries) {
				expect(entry.columns).toBe(entries[0]?.columns);
			}
		}
		unmount(component);
	});
});
