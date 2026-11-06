// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import DropdownMenuFixture from './dropdown-menu.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('DropdownMenu', () => {
	test('opens from the trigger with menu items', () => {
		const component = mount(DropdownMenuFixture, { target: document.body });
		expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull();
		document
			.querySelector('[data-slot="dropdown-menu-trigger"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		const content = document.querySelector('[data-slot="dropdown-menu-content"]');
		expect(content?.getAttribute('data-state')).toBe('open');
		expect(content?.getAttribute('class')).toContain('data-[state=open]:animate-in');
		expect(content?.querySelectorAll('[data-slot="dropdown-menu-item"]')).toHaveLength(2);
		unmount(component);
	});

	test('choosing an item closes the menu', async () => {
		const component = mount(DropdownMenuFixture, {
			target: document.body,
			props: { open: true }
		});
		flushSync();
		document
			.querySelector('[data-slot="dropdown-menu-item"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await vi.waitFor(() => {
			flushSync();
			const content = document.querySelector('[data-slot="dropdown-menu-content"]');
			expect(content === null || content.getAttribute('data-state') === 'closed').toBe(true);
		});
		unmount(component);
	});
});
