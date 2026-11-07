// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { changeInsulation } = vi.hoisted(() => ({ changeInsulation: vi.fn() }));

vi.mock('#lib/db/mutations/index.js', () => ({ changeInsulation }));

import InsulationsDropdownFixture, {
	get_fixture_state
} from './insulations-dropdown.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

describe('InsulationsDropdown', () => {
	test('silently repairs TW-Cu past its rating without an undo entry', () => {
		const component = mount(InsulationsDropdownFixture, { target: document.body });
		flushSync();
		expect(changeInsulation).toHaveBeenCalledWith({
			node_id: 'node-a',
			insulation: 'THHN-Cu',
			type: 'conductor'
		});
		expect(get_fixture_state().hasUndoActions()).toBe(false);
		expect(get_fixture_state().has_unsaved_actions).toBe(true);
		unmount(component);
	});
});
