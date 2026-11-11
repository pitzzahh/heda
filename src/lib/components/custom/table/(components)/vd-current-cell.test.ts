// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const stored_node = { id: 'node-a', parent_id: 'root', load_data: { use_at_as_current: false } };

const { useAtAsCurrentsValue, updateNode, getNode } = vi.hoisted(() => ({
	useAtAsCurrentsValue: vi.fn(),
	updateNode: vi.fn(),
	getNode: vi.fn()
}));

vi.mock('#lib/db/mutations/index.js', () => ({ useAtAsCurrentsValue, updateNode }));
vi.mock('#lib/db/queries/index.js', () => ({ getNode }));

import VdCurrentCellFixture, { get_fixture_state } from './vd-current-cell.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

describe('VdCurrentCell', () => {
	test('undo restores the stored node, not the computed table row', async () => {
		getNode.mockReturnValue(stored_node);
		useAtAsCurrentsValue.mockReturnValue({
			...stored_node,
			load_data: { use_at_as_current: true }
		});
		const component = mount(VdCurrentCellFixture, { target: document.body });
		flushSync();

		document.querySelector<HTMLButtonElement>('[data-slot="button"]')!.click();
		await get_fixture_state().undo();

		expect(updateNode).toHaveBeenCalledWith({
			id: 'node-a',
			whole_data: stored_node,
			parent_id: 'root'
		});
		unmount(component);
	});
});
