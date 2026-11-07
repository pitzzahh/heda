// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('$app/state', () => ({
	page: { params: {} }
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/paths', () => ({
	resolve: (path: string) => path
}));

vi.mock('#lib/db/queries/index.js', () => ({
	getChildNodesByParentId: () => []
}));

vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

import UnitItemFixture from './tree-unit-item.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('TreeUnitItem', () => {
	test('renders the unit row with add triggers and no children', async () => {
		const component = mount(UnitItemFixture, { target: document.body });
		flushSync();
		expect(document.body.textContent).toContain('LP-A');
		const trigger = [...document.querySelectorAll('button')].find(
			(element) => element.textContent?.trim() === 'Actions'
		);
		trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		await tick();
		flushSync();
		const text = document.body.textContent ?? '';
		expect(text).toContain('Add Panel');
		expect(text).toContain('Add Load');
		unmount(component);
	});
});
