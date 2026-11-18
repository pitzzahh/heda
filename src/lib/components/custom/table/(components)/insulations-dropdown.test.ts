// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { changeInsulation } = vi.hoisted(() => ({ changeInsulation: vi.fn() }));

vi.mock('#lib/db/mutations/index.js', () => ({ changeInsulation }));

import InsulationsDropdownFixture, {
	get_fixture_state
} from './insulations-dropdown.fixture.svelte';
import { isTwBarred } from './insulations-dropdown.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

describe('InsulationsDropdown', () => {
	test('bars TW from conductors of circuits over 100 A (PEC 2017 1.10.1.14(C)(1)(b))', () => {
		expect(isTwBarred('conductor', 110)).toBe(true);
		expect(isTwBarred('conductor', 100)).toBe(false);
		// The EGC is not a termination of the circuit's conductors.
		expect(isTwBarred('egc', 600)).toBe(false);
	});

	test('never writes on its own: a TW conductor past 100 A stays for the engine to flag', () => {
		const component = mount(InsulationsDropdownFixture, { target: document.body });
		flushSync();
		expect(changeInsulation).not.toHaveBeenCalled();
		expect(get_fixture_state().has_unsaved_actions).toBe(false);
		unmount(component);
	});
});
