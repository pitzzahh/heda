// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import TooltipFixture from './tooltip.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Tooltip', () => {
	test('renders content with the delayed-open keyframes', () => {
		const component = mount(TooltipFixture, {
			target: document.body,
			props: { open: true }
		});
		flushSync();
		const content = document.querySelector('[data-slot="tooltip-content"]');
		expect(content).not.toBeNull();
		expect(content?.textContent).toContain('Tooltip body');
		expect(content?.getAttribute('class')).toContain('data-[state=delayed-open]:animate-in');
		unmount(component);
	});

	test('opens on focus', async () => {
		const component = mount(TooltipFixture, { target: document.body });
		(document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement)?.focus();
		await new Promise((r) => setTimeout(r, 500));
		flushSync();
		expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull();
		unmount(component);
	});
});
