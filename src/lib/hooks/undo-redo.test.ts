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

		await undo_redo_state.copyNodeById(panel!.id);
		expect(getChildNodesByParentId(root)).toHaveLength(2);
		expect(undo_redo_state.hasUndoActions()).toBe(true);

		undo_redo_state.undo();
		expect(getChildNodesByParentId(root)).toHaveLength(1);
	});

	test('a save only clears the unsaved flag if no edit landed after its snapshot', () => {
		const undo_redo_state = new UndoRedoState();
		undo_redo_state.setHasUnsavedActions();
		const saved_version = undo_redo_state.edit_version;
		undo_redo_state.setHasUnsavedActions();

		undo_redo_state.resetUnsavedActions(saved_version);
		expect(undo_redo_state.has_unsaved_actions).toBe(true);

		undo_redo_state.resetUnsavedActions(undo_redo_state.edit_version);
		expect(undo_redo_state.has_unsaved_actions).toBe(false);
	});

	test('undo and redo with empty history leave the project clean', async () => {
		const undo_redo_state = new UndoRedoState();
		await undo_redo_state.undo();
		await undo_redo_state.redo();
		expect(undo_redo_state.has_unsaved_actions).toBe(false);
	});

	test('resetting without a version always clears the unsaved flag', () => {
		const undo_redo_state = new UndoRedoState();
		undo_redo_state.setHasUnsavedActions();
		undo_redo_state.resetUnsavedActions();
		expect(undo_redo_state.has_unsaved_actions).toBe(false);
	});
});
