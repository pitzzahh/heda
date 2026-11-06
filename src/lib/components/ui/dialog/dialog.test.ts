// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import DialogFixture from './dialog.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

function openViaTrigger() {
	const component = mount(DialogFixture, { target: document.body });
	expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
	document
		.querySelector('[data-slot="dialog-trigger"]')
		?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	flushSync();
	return component;
}

describe('Dialog', () => {
	test('opens from the trigger with the keyframe contract', () => {
		const component = openViaTrigger();
		const content = document.querySelector('[data-slot="dialog-content"]');
		expect(content?.getAttribute('data-state')).toBe('open');
		expect(content?.getAttribute('class')).toContain('data-[state=open]:animate-in');
		expect(content?.textContent).toContain('Fixture body');
		expect(document.querySelector('[data-slot="dialog-backdrop"]')).not.toBeNull();
		unmount(component);
	});

	test('closes on Escape', async () => {
		const component = openViaTrigger();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		// jsdom runs no CSS animations, so bits-ui may leave the closed frame mounted.
		await vi.waitFor(() => {
			flushSync();
			const content = document.querySelector('[data-slot="dialog-content"]');
			expect(content === null || content.getAttribute('data-state') === 'closed').toBe(true);
		});
		unmount(component);
	});

	test('mounts open when bound open starts true', () => {
		const component = mount(DialogFixture, { target: document.body, props: { open: true } });
		flushSync();
		expect(document.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
		unmount(component);
	});
});
