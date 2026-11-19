// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { overrideField } = vi.hoisted(() => ({
	overrideField: vi.fn(() => ({}))
}));
vi.mock('#lib/db/mutations/index.js', () => ({ overrideField }));
vi.mock('#lib/hooks/undo-redo.svelte.js', () => ({
	getUndoRedoState: () => ({ setActionToUndo: vi.fn() })
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn() } }));

const {
	default: OverrideSelectors,
	valueAt,
	stepUp,
	stepDown,
	isPicked
} = await import('./override-selectors.svelte');

afterEach(() => {
	document.body.innerHTML = '';
	overrideField.mockClear();
});

const no_overrides = {
	egc_size: false,
	at: false,
	conductor_size: false,
	conduit_size: false,
	ampere_frames: false,
	length: false,
	z: false
};

describe('override pickers', () => {
	test('a value in no list (-1) picks nothing, not the last entry', () => {
		expect(valueAt([2, 3.5, 500], -1)).toBeUndefined();
		expect(valueAt([2, 3.5, 500], 2)).toBe(500);
	});

	test('steps from nothing land on the ends of the list', () => {
		expect(stepUp(-1, 2)).toBe(0);
		expect(stepDown(-1, 2)).toBe(2);
		expect(stepUp(2, 2)).toBe(0);
		expect(stepDown(0, 2)).toBe(2);
	});

	test('only a chosen, different value is written', () => {
		expect(isPicked(undefined, -1)).toBe(false);
		expect(isPicked(30, 30)).toBe(false);
		expect(isPicked(40, 30)).toBe(true);
	});

	test('a circuit no conductor fits offers no override until something changes', () => {
		const component = mount(OverrideSelectors, {
			target: document.body,
			props: {
				node_id: 'x',
				closeDialog: vi.fn(),
				current_at: 700,
				current_ampere_frames: 700,
				current_conductor_size: -1,
				current_egc_size: 50,
				current_conduit_size: -1,
				overridden_fields: no_overrides
			}
		});
		flushSync();
		const override = [...document.querySelectorAll('button')].find((button) =>
			button.textContent?.trim().startsWith('Override')
		);
		// Disabled is the whole guarantee: browsers drop clicks on it (jsdom does not).
		expect(override?.disabled).toBe(true);
		unmount(component);
	});
});
