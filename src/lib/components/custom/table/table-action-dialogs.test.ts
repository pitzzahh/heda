// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';

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

import { initializeDatabase } from '#lib/db/index.js';
import { addNode, createProject, resetData } from '#lib/db/mutations/index.js';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants/index.js';
import Fixture from './table-action-dialogs.fixture.svelte';

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

beforeAll(async () => {
	await initializeDatabase();
});

type FixtureApi = {
	refresh: () => void;
	enable_multi_copy: () => void;
	has_undo_actions: () => boolean;
};

async function seed() {
	resetData();
	const created = await createProject('Dialogs', {
		distribution_unit: 'DU',
		phase: default_phases.ONE_PHASE
	});
	const panel = addNode({
		parent_id: created!.root_node_id,
		panel_data: {
			name: 'LP-1',
			circuit_number: 1,
			ambient_temperature: 30,
			length: 10,
			terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
			phase: default_phases.ONE_PHASE
		}
	})!;
	for (const circuit_number of [1, 2]) {
		addNode({
			parent_id: panel.id,
			load_data: {
				load_type: default_load_types.GENERAL_LIGHTING,
				quantity: 50,
				varies: '1000',
				load_description: `Load ${circuit_number}`,
				continuous: false,
				circuit_number,
				length: 10,
				ambient_temperature: 30,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				config_preference: 'CUSTOM'
			}
		});
	}
	return panel.id;
}

function row_triggers() {
	return [...document.querySelectorAll('[data-slot="dropdown-menu-trigger"]')];
}

async function click_menu_item(trigger_index: number, label: string) {
	row_triggers()[trigger_index]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	flushSync();
	const item = [...document.querySelectorAll('[role="menuitem"]')].find((element) =>
		element.textContent?.includes(label)
	);
	expect(item).not.toBeUndefined();
	item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	flushSync();
}

function dialog_text() {
	return document.querySelector('[data-slot="dialog-content"]')?.textContent ?? '';
}

function dialog_state() {
	return document.querySelector('[data-slot="dialog-content"]')?.getAttribute('data-state');
}

function confirm_text() {
	return document.querySelector('[data-slot="alert-dialog-content"]')?.textContent ?? '';
}

test('update dialog opens for the clicked row', async () => {
	const component = mount(Fixture, { target: document.body, props: { node_id: await seed() } });
	flushSync();
	expect(row_triggers()).toHaveLength(2);

	await click_menu_item(1, 'Update');
	expect(dialog_text()).toContain('Update load');
	unmount(component);
});

test('override dialog shows the clicked row load', async () => {
	const component = mount(Fixture, { target: document.body, props: { node_id: await seed() } });
	flushSync();

	await click_menu_item(1, 'Override');
	expect(dialog_text()).toContain('Load 2');
	unmount(component);
});

test('delete removes the row and records undo', async () => {
	const component = mount(Fixture, { target: document.body, props: { node_id: await seed() } });
	flushSync();
	const api = component as unknown as FixtureApi;
	expect(document.querySelectorAll('tbody tr')).toHaveLength(2);

	await click_menu_item(0, 'Delete');
	expect(confirm_text()).toContain('Are you absolutely sure?');
	const confirm = [...document.querySelectorAll('button')].find((element) =>
		element.textContent?.includes('Remove load')
	);
	expect(confirm).not.toBeUndefined();
	confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	flushSync();

	api.refresh();
	flushSync();
	expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
	expect(api.has_undo_actions()).toBe(true);
	// Confirming closes the prompt; it must not linger over the table.
	expect(
		document.querySelector('[data-slot="alert-dialog-content"]')?.getAttribute('data-state') ??
			'closed'
	).toBe('closed');
	unmount(component);
});

test('copy dialog reopens after closing', async () => {
	const component = mount(Fixture, { target: document.body, props: { node_id: await seed() } });
	flushSync();
	const api = component as unknown as FixtureApi;
	api.enable_multi_copy();

	await click_menu_item(0, 'Copy');
	expect(dialog_text()).toContain('Copy Load 1');
	expect(dialog_state()).toBe('open');
	document
		.querySelector('[data-slot="dialog-close"]')
		?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	await tick();
	flushSync();
	expect(['closed', null]).toContain(
		document.querySelector('[data-slot="dialog-content"]') === null ? null : dialog_state()
	);

	await click_menu_item(0, 'Copy');
	expect(dialog_state()).toBe('open');
	unmount(component);
});
