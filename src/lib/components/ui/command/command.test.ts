// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import CommandFixture from './command.fixture.svelte';

// jsdom has no scrollIntoView; bits-ui calls it when highlighting an item.
Element.prototype.scrollIntoView ??= () => {};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('Command', () => {
	test('renders input, items and empty state', () => {
		const component = mount(CommandFixture, { target: document.body });
		flushSync();
		expect(document.querySelector('[data-slot="command"]')).not.toBeNull();
		expect(document.querySelector('[data-slot="command-input"]')).not.toBeNull();
		expect(document.querySelectorAll('[data-slot="command-item"]')).toHaveLength(2);
		unmount(component);
	});

	test('typing filters the items', async () => {
		const component = mount(CommandFixture, { target: document.body });
		flushSync();
		const input = document.querySelector('[data-slot="command-input"]') as HTMLInputElement;
		input.focus();
		input.value = 'alp';
		input.dispatchEvent(new InputEvent('input', { bubbles: true }));
		// The search → filter cascade settles asynchronously; non-matches unmount.
		await tick();
		await new Promise((r) => setTimeout(r, 100));
		flushSync();
		const items = [...document.querySelectorAll('[data-slot="command-item"]')];
		expect(items.map((item) => item.textContent?.trim())).toEqual(['Alpha']);
		unmount(component);
	});
});
