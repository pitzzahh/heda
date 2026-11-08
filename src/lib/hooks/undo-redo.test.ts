import { beforeAll, describe, expect, test } from 'vitest';
import { STANDARD_TERMINAL_TEMPERATURE, default_phases } from '#lib/constants/index.js';
import { initializeDatabase } from '#lib/db/index.js';
import { addNode, createProject, resetData } from '#lib/db/mutations/index.js';
import { getChildNodesByParentId } from '#lib/db/queries/index.js';
import { UndoRedoState } from './undo-redo.svelte.js';

beforeAll(async () => {
	await initializeDatabase();
});

describe('UndoRedoState', () => {
	test('copyNodeById duplicates the node and records an undoable action', async () => {
		resetData();
		const undo_redo_state = new UndoRedoState();
		expect(undo_redo_state.hasUndoActions()).toBe(false);

		const created = await createProject('Copy', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});

		undo_redo_state.copyNodeById(panel!.id);
		expect(getChildNodesByParentId(root)).toHaveLength(2);
		expect(undo_redo_state.hasUndoActions()).toBe(true);

		undo_redo_state.undo();
		expect(getChildNodesByParentId(root)).toHaveLength(1);
	});
});
