// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { updateInterruptingRating, setActionToUndo } = vi.hoisted(() => ({
	updateInterruptingRating: vi.fn(() => ({ id: 'n', kaic: '18' })),
	setActionToUndo: vi.fn()
}));
vi.mock('#lib/db/mutations/index.js', () => ({ updateInterruptingRating }));
vi.mock('#lib/db/queries/index.js', () => ({ getNode: () => ({ id: 'n', kaic: '5' }) }));
vi.mock('#lib/hooks/undo-redo.svelte.js', () => ({
	getUndoRedoState: () => ({ setActionToUndo })
}));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));

const { default: KaicCell } = await import('./kaic-cell.svelte');

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

function type(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

function blur(input: HTMLInputElement) {
	input.dispatchEvent(new FocusEvent('blur'));
	flushSync();
}

describe('KaicCell', () => {
	const props = { kaic: 5, node: { id: 'n' } as never };

	test('saves a new rating on blur and records it for undo', () => {
		const component = mount(KaicCell, { target: document.body, props });
		const input = document.querySelector('input')!;
		type(input, '18');
		blur(input);
		expect(updateInterruptingRating).toHaveBeenCalledWith({ node_id: 'n', kaic: 18 });
		expect(setActionToUndo).toHaveBeenCalledOnce();
		unmount(component);
	});

	test('reverts a cleared or zero rating without saving', () => {
		const component = mount(KaicCell, { target: document.body, props });
		const input = document.querySelector('input')!;
		for (const value of ['', '0']) {
			type(input, value);
			blur(input);
			expect(input.value).toBe('5');
		}
		expect(updateInterruptingRating).not.toHaveBeenCalled();
		unmount(component);
	});

	test('Escape drops the draft', () => {
		const component = mount(KaicCell, { target: document.body, props });
		const input = document.querySelector('input')!;
		type(input, '22');
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();
		blur(input);
		expect(input.value).toBe('5');
		expect(updateInterruptingRating).not.toHaveBeenCalled();
		unmount(component);
	});
});
