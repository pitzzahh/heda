// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { useAtAsCurrentsValue } = vi.hoisted(() => ({ useAtAsCurrentsValue: vi.fn() }));

vi.mock('#lib/db/mutations/index.js', () => ({ useAtAsCurrentsValue }));

import VdCurrentCellFixture from './vd-current-cell.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

// Undo of the toggle is the engine's (crates/heda-core/tests/edit.rs).
describe('VdCurrentCell', () => {
	test('switches the stored node to use its AT as the current', () => {
		const component = mount(VdCurrentCellFixture, { target: document.body });
		flushSync();

		document.querySelector<HTMLButtonElement>('[data-slot="button"]')!.click();

		expect(useAtAsCurrentsValue).toHaveBeenCalledWith('node-a', true);
		unmount(component);
	});
});
