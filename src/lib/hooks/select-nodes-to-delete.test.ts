import { describe, expect, test } from 'vitest';
import { SelectNodesToDelete } from './select-nodes-to-delete.svelte.js';

describe('SelectNodesToDelete', () => {
	test('toggles membership and reports count', () => {
		const state = new SelectNodesToDelete();
		expect(state.getSelectedNodeIdsCount()).toBe(0);

		state.addOrRemoveNodeId('a');
		state.addOrRemoveNodeId('b');
		expect(state.checkIsIdSelected('a')).toBe(true);
		expect(state.checkIsIdSelected('b')).toBe(true);
		expect(state.getSelectedNodeIdsCount()).toBe(2);

		state.addOrRemoveNodeId('a');
		expect(state.checkIsIdSelected('a')).toBe(false);
		expect(state.getSelectedNodeIdsCount()).toBe(1);
	});

	test('removes one id and clears all', () => {
		const state = new SelectNodesToDelete();
		state.addOrRemoveNodeId('a');
		state.addOrRemoveNodeId('b');

		state.removeNodeId('a');
		expect(state.checkIsIdSelected('a')).toBe(false);
		expect(state.checkIsIdSelected('b')).toBe(true);

		state.removeAllNodeIds();
		expect(state.getSelectedNodeIdsCount()).toBe(0);
		expect([...state.selected_nodes_id].length).toBe(0);
	});
});
