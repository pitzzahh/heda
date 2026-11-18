// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('#lib/db/mutations/index.js', () => ({
	changePhaseAssignment: vi.fn(),
	updateNode: vi.fn()
}));
vi.mock('#lib/db/queries/index.js', () => ({ getNode: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }));

import PhaseDropdownFixture from './phase-dropdown.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('PhaseDropdown', () => {
	test('offers a phase picker for a single-phase circuit', () => {
		const component = mount(PhaseDropdownFixture, { target: document.body, props: { phase: 'B' } });
		flushSync();
		const trigger = document.querySelector('[aria-label="Phase"]');
		expect(trigger?.textContent?.trim()).toBe('B');
		unmount(component);
	});

	test('shows the line pair of a circuit on a delta panel', () => {
		const component = mount(PhaseDropdownFixture, {
			target: document.body,
			props: { phase: 'BC', supply_phase: 'three_phase_delta' }
		});
		flushSync();
		expect(document.querySelector('[aria-label="Phase"]')?.textContent?.trim()).toBe('BC');
		unmount(component);
	});

	test('shows ABC with nothing to pick for a three-phase circuit', () => {
		const component = mount(PhaseDropdownFixture, {
			target: document.body,
			props: { phase: 'ABC' }
		});
		flushSync();
		expect(document.querySelector('[aria-label="Phase"]')).toBeNull();
		expect(document.body.textContent).toContain('ABC');
		unmount(component);
	});
});
