// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import TooltipFixture from './tooltip.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Tooltip', () => {
	test('renders content with the delayed-open contract', () => {
		const component = mount(TooltipFixture, {
			target: document.body,
			props: { open: true }
		});
		flushSync();
		const content = document.querySelector('[data-slot="tooltip-content"]');
		expect(content).not.toBeNull();
		expect(content?.textContent).toContain('Tooltip body');
		expect(content?.getAttribute('class')).toContain('data-[state=delayed-open]:opacity-100');
		unmount(component);
	});

	test('opens on focus', async () => {
		const component = mount(TooltipFixture, { target: document.body });
		(document.querySelector('[data-slot="tooltip-trigger"]') as HTMLElement)?.focus();
		await vi.waitFor(
			() => {
				flushSync();
				expect(document.querySelector('[data-slot="tooltip-content"]')).not.toBeNull();
			},
			{ timeout: 2000 }
		);
		unmount(component);
	});
});
