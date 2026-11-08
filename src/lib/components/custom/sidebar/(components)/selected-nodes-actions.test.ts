// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import SelectedNodesActionsFixture from './selected-nodes-actions.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('SelectedNodesActions', () => {
	test('shows the selected count from context state', () => {
		const component = mount(SelectedNodesActionsFixture, { target: document.body });
		flushSync();
		expect(document.body.textContent).toContain('Unselect All 2 Items');
		expect(document.body.textContent).toContain('Remove Selected 2 Items');
		unmount(component);
	});
});
