// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AlertDialogFixture from './alert-dialog.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('AlertDialog', () => {
	test('opens from the trigger with title and actions', () => {
		const component = mount(AlertDialogFixture, { target: document.body });
		expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull();
		document
			.querySelector('[data-slot="alert-dialog-trigger"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		const content = document.querySelector('[data-slot="alert-dialog-content"]');
		expect(content?.getAttribute('data-state')).toBe('open');
		expect(content?.getAttribute('class')).toContain('transition-[opacity,transform]');
		expect(content?.textContent).toContain('Confirm delete');
		expect(document.querySelector('[data-slot="alert-dialog-cancel"]')).not.toBeNull();
		expect(document.querySelector('[data-slot="alert-dialog-action"]')).not.toBeNull();
		unmount(component);
	});

	test('cancel closes the dialog', async () => {
		const component = mount(AlertDialogFixture, { target: document.body });
		document
			.querySelector('[data-slot="alert-dialog-trigger"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		document
			.querySelector('[data-slot="alert-dialog-cancel"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await vi.waitFor(() => {
			flushSync();
			const content = document.querySelector('[data-slot="alert-dialog-content"]');
			expect(content === null || content.getAttribute('data-state') === 'closed').toBe(true);
		});
		unmount(component);
	});
});
