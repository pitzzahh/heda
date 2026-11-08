// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('#lib/db/queries/index.js', () => {
	const panel_node = {
		id: 'panel-1',
		node_type: 'panel',
		parent_id: 'root',
		panel_data: { name: 'LP-A' },
		child_ids: []
	};
	const load_nodes = Array.from({ length: 100 }, (_, index) => ({
		id: `load-${index}`,
		node_type: 'load',
		parent_id: 'panel-1',
		load_data: { load_description: `Load ${index}` },
		child_ids: []
	}));

	return {
		getChildNodesByParentId: (parent_id: string) => {
			if (parent_id === 'root') return [panel_node];
			if (parent_id === 'panel-1') return load_nodes;
			return [];
		},
		getNodeById: (id: string) => {
			if (id === 'panel-1') return panel_node;
			return load_nodes.find((node) => node.id === id);
		}
	};
});

vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

import SidebarTreeFixture, { get_fixture_settings_state } from './sidebar-tree.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	localStorage.clear();
});

const rendered_rows = () => document.querySelectorAll('li [data-sidebar="menu-item"]').length;

describe('SidebarTree virtualization', () => {
	test('only renders a window of loads and toggles visibility cheaply', () => {
		const component = mount(SidebarTreeFixture, { target: document.body });
		flushSync();

		expect(rendered_rows()).toBe(2);
		expect(document.body.textContent).not.toContain('Load 99');

		get_fixture_settings_state().setShowLoadsOnUnitHeirarchy(true);
		flushSync();

		// 2 units + 100 loads exist, but only the initial window is in the DOM.
		expect(rendered_rows()).toBe(20);
		expect(document.body.textContent).toContain('Load 0');
		expect(document.body.textContent).not.toContain('Load 99');

		get_fixture_settings_state().setShowLoadsOnUnitHeirarchy(false);
		flushSync();

		expect(rendered_rows()).toBe(2);
		unmount(component);
	});
});
