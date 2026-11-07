// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

import LoadItemFixture, {
	get_calls,
	get_fixture_select_state
} from './tree-load-item.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('TreeLoadItem', () => {
	test('alt-click selects the node', () => {
		const component = mount(LoadItemFixture, { target: document.body });
		flushSync();
		expect(document.body.textContent).toContain('L1');
		const button = [...document.querySelectorAll('button')].find((element) =>
			element.textContent?.includes('L1')
		);
		button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(get_fixture_select_state().checkIsIdSelected('load-1')).toBe(true);
		unmount(component);
	});

	test('menu copy forwards the multi flag', async () => {
		const component = mount(LoadItemFixture, { target: document.body });
		flushSync();
		const trigger = [...document.querySelectorAll('button')].find(
			(element) => element.textContent?.trim() === 'Actions'
		);
		trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();
		flushSync();
		const item = [...document.querySelectorAll('[role="menuitem"]')].find((element) =>
			element.textContent?.includes('Copy Load')
		);
		expect(item).not.toBeUndefined();
		item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(get_calls()).toContainEqual({ id: 'load-1', multi: expect.any(Boolean) });
		unmount(component);
	});
});
