// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { setGeneratorKva, setStandbyPanels } = vi.hoisted(() => ({
	setGeneratorKva: vi.fn(),
	setStandbyPanels: vi.fn()
}));

vi.mock('#lib/db/mutations/index.js', () => ({ setGeneratorKva, setStandbyPanels }));

vi.mock('#lib/db/queries/index.js', () => ({
	getAllChildNodes: () => [
		{ id: 'LP-1', node_type: 'panel', panel_data: { name: 'LP-1' } },
		{ id: 'LP-2', node_type: 'panel', panel_data: { name: 'LP-2' } }
	]
}));

vi.mock('svelte-sonner', () => ({
	toast: { warning: vi.fn(), success: vi.fn() }
}));

import StandbyGeneratorSection from './standby-generator-section.svelte';
import type { Node } from '#lib/types/db.js';

const root = { id: 'root', node_type: 'root', highest_unit_form: {} } as Node;

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

const settle = async () => {
	await new Promise((resolve) => setTimeout(resolve, 0));
	flushSync();
};

function box(name: string) {
	const label = [...document.querySelectorAll('label')].find((l) => l.textContent?.includes(name));
	return label!.querySelector<HTMLElement>('[role="checkbox"]')!;
}

describe('StandbyGeneratorSection', () => {
	test('a second toggle waits for the first, so neither panel is lost', async () => {
		setStandbyPanels.mockReturnValue(new Promise(() => {}));
		const component = mount(StandbyGeneratorSection, { target: document.body, props: { root } });
		flushSync();
		box('LP-1').click();
		flushSync();
		box('LP-2').click();
		await settle();
		expect(setStandbyPanels).toHaveBeenCalledTimes(1);
		expect(setStandbyPanels).toHaveBeenCalledWith('root', ['LP-1']);
		unmount(component);
	});

	test('a refused toggle leaves the box as stored', async () => {
		setStandbyPanels.mockResolvedValue(undefined);
		const component = mount(StandbyGeneratorSection, { target: document.body, props: { root } });
		flushSync();
		box('LP-1').click();
		await settle();
		expect(box('LP-1').getAttribute('aria-checked')).toBe('false');
		unmount(component);
	});

	test('a saved rating can be cleared again', async () => {
		setGeneratorKva.mockResolvedValue(root);
		const component = mount(StandbyGeneratorSection, { target: document.body, props: { root } });
		flushSync();
		const input = document.querySelector<HTMLInputElement>('#generator_kva')!;
		const save = document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
		const type = (value: string) => {
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
			flushSync();
		};
		type('25');
		document.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await settle();
		await tick();
		expect(setGeneratorKva).toHaveBeenCalledWith('root', 25);
		type('');
		expect(save.disabled).toBe(false);
		unmount(component);
	});
});
