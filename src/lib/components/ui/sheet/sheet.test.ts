// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import SheetFixture from './sheet.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Sheet', () => {
	test('slides in from the trigger side', () => {
		const component = mount(SheetFixture, { target: document.body });
		document
			.querySelector('[data-slot="sheet-trigger"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		const content = document.querySelector('[data-slot="sheet-content"]');
		expect(content?.getAttribute('data-state')).toBe('open');
		expect(content?.getAttribute('data-side')).toBe('right');
		expect(content?.getAttribute('class')).toContain('slide-in-from-right');
		unmount(component);
	});

	test('left side slides from the left', () => {
		const component = mount(SheetFixture, {
			target: document.body,
			props: { open: true, side: 'left' }
		});
		flushSync();
		const content = document.querySelector('[data-slot="sheet-content"]');
		expect(content?.getAttribute('data-side')).toBe('left');
		expect(content?.getAttribute('class')).toContain('slide-in-from-left');
		unmount(component);
	});

	test('closes on Escape', async () => {
		const component = mount(SheetFixture, {
			target: document.body,
			props: { open: true }
		});
		flushSync();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await vi.waitFor(() => {
			flushSync();
			const content = document.querySelector('[data-slot="sheet-content"]');
			expect(content === null || content.getAttribute('data-state') === 'closed').toBe(true);
		});
		unmount(component);
	});
});
