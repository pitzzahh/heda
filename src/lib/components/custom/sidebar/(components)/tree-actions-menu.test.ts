// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

import ActionsMenuFixture, { get_calls } from './tree-actions-menu.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('TreeActionsMenu', () => {
	test('runs the clicked action callback', async () => {
		const component = mount(ActionsMenuFixture, { target: document.body });
		flushSync();
		const trigger = [...document.querySelectorAll('button')].find((element) =>
			element.textContent?.includes('Actions')
		);
		trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();
		flushSync();
		const item = [...document.querySelectorAll('[role="menuitem"]')].find((element) =>
			element.textContent?.includes('Copy it')
		);
		expect(item).not.toBeUndefined();
		item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(get_calls()).toEqual(['copy']);
		unmount(component);
	});
});
