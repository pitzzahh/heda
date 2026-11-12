// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { goto_mock, resolve_mock } = vi.hoisted(() => ({
	// The real goto returns a promise the caller chains on.
	goto_mock: vi.fn(() => Promise.resolve()),
	resolve_mock: vi.fn((path: string, params?: Record<string, string>) =>
		params ? `${path}/${params.id}` : path
	)
}));

vi.mock('$app/state', () => ({
	page: { params: {} }
}));

vi.mock('$app/navigation', () => ({
	goto: goto_mock
}));

vi.mock('$app/paths', () => ({
	resolve: resolve_mock
}));

vi.mock('#lib/db/queries/index.js', () => ({
	getChildNodesByParentId: () => []
}));

vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

import RootItemFixture, { get_fixture_node } from './tree-unit-item.root.fixture.svelte';
import { nodeIdFromRouteId } from '#lib/helpers/navigation/index.js';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

describe('TreeUnitItem (root)', () => {
	test('keeps a name with a slash in one route segment', async () => {
		const component = mount(RootItemFixture, { target: document.body });
		flushSync();

		const row = [...document.querySelectorAll('button')].find((element) =>
			element.textContent?.includes('Utility Meter')
		);
		row?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();

		expect(resolve_mock).toHaveBeenCalledTimes(1);
		const route_id = resolve_mock.mock.calls[0][1]?.id as string;
		// A raw slash would split the path and the route would never match.
		expect(route_id).not.toContain('/');
		expect(nodeIdFromRouteId(route_id)).toBe(get_fixture_node().id);
		expect(goto_mock).toHaveBeenCalledTimes(1);
		unmount(component);
	});
});
