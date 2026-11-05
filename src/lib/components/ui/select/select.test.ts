// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import SelectFixture from './select.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Select', () => {
	test('opens from the trigger with options', () => {
		const component = mount(SelectFixture, { target: document.body });
		expect(document.querySelector('[data-slot="select-content"]')).toBeNull();
		document
			.querySelector('[data-slot="select-trigger"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		const content = document.querySelector('[data-slot="select-content"]');
		expect(content?.getAttribute('data-state')).toBe('open');
		expect(content?.getAttribute('class')).toContain('data-[state=open]:animate-in');
		expect(content?.querySelectorAll('[data-slot="select-item"]')).toHaveLength(2);
		unmount(component);
	});

	test('choosing an option sets the value and closes', async () => {
		const component = mount(SelectFixture, {
			target: document.body,
			props: { open: true }
		});
		flushSync();
		// bits-ui selects on pointerup, not click: dispatch the real press sequence.
		const items = document.querySelectorAll('[data-slot="select-item"]');
		items[1]?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
		items[1]?.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
		await new Promise((r) => setTimeout(r, 50));
		flushSync();
		expect(document.querySelector('[data-testid="value"]')?.textContent).toBe('b');
		const content = document.querySelector('[data-slot="select-content"]');
		expect(content === null || content.getAttribute('data-state') === 'closed').toBe(true);
		unmount(component);
	});
});
