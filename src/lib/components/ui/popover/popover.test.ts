// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import PopoverFixture from './popover.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Popover', () => {
	test('opens from the trigger with the anchored contract', () => {
		const component = mount(PopoverFixture, { target: document.body });
		expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
		document
			.querySelector('[data-slot="popover-trigger"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		const content = document.querySelector('[data-slot="popover-content"]');
		expect(content?.getAttribute('data-state')).toBe('open');
		expect(content?.getAttribute('class')).toContain('data-[state=open]:opacity-100');
		expect(content?.textContent).toContain('Popover body');
		unmount(component);
	});

	test('closes on Escape', async () => {
		const component = mount(PopoverFixture, {
			target: document.body,
			props: { open: true }
		});
		flushSync();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await vi.waitFor(() => {
			flushSync();
			const content = document.querySelector('[data-slot="popover-content"]');
			expect(content === null || content.getAttribute('data-state') === 'closed').toBe(true);
		});
		unmount(component);
	});
});
