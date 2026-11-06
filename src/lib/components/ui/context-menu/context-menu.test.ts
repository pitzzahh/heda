// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ContextMenuFixture from './context-menu.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('ContextMenu', () => {
	test('opens on right-click with the anchored contract', () => {
		const component = mount(ContextMenuFixture, { target: document.body });
		expect(document.querySelector('[data-slot="context-menu-content"]')).toBeNull();
		document
			.querySelector('[data-slot="context-menu-trigger"]')
			?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
		flushSync();
		const content = document.querySelector('[data-slot="context-menu-content"]');
		expect(content?.getAttribute('data-state')).toBe('open');
		expect(content?.getAttribute('class')).toContain('data-[state=open]:animate-in');
		unmount(component);
	});

	test('closes on Escape', async () => {
		const component = mount(ContextMenuFixture, {
			target: document.body,
			props: { open: true }
		});
		flushSync();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await vi.waitFor(() => {
			flushSync();
			const content = document.querySelector('[data-slot="context-menu-content"]');
			expect(content === null || content.getAttribute('data-state') === 'closed').toBe(true);
		});
		unmount(component);
	});
});
