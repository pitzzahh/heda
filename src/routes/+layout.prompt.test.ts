// @vitest-environment jsdom
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	const fn = () => ({
		matches: false,
		addEventListener: () => {},
		removeEventListener: () => {}
	});
	Object.defineProperty(window, 'matchMedia', { value: fn, configurable: true });
	Object.defineProperty(globalThis, 'matchMedia', { value: fn, configurable: true });
});

vi.mock('$app/navigation', () => ({ goto: vi.fn(async () => {}) }));
vi.mock('#lib/helpers/file/index.js', () => ({ saveCurrentProject: vi.fn(async () => true) }));

import LayoutFixture from './unsaved-prompt.layout.fixture.svelte';
import { get_dialogs } from './unsaved-prompt.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

function prompt_state() {
	return (
		document.querySelector('[data-slot="alert-dialog-content"]')?.getAttribute('data-state') ??
		'closed'
	);
}

describe('unsaved changes prompt', () => {
	for (const [label, decision] of [
		['Save changes', 'save'],
		["Don't save", 'continue']
	] as const) {
		it(`closes after "${label}" instead of lingering on the next page`, async () => {
			const app = mount(LayoutFixture, { target: document.body });
			flushSync();

			const decided = get_dialogs().promptUnsavedChanges();
			flushSync();
			await tick();
			expect(prompt_state()).toBe('open');

			const button = [...document.querySelectorAll('button')].find(
				(element) => element.textContent?.trim() === label
			);
			button!.click();
			flushSync();
			await tick();

			await expect(decided).resolves.toBe(decision);
			expect(get_dialogs().has_unsaved_changes).toBe(false);
			expect(prompt_state()).toBe('closed');
			unmount(app);
		});
	}
});
