import { beforeAll, describe, expect, test } from 'vitest';
import { STANDARD_TERMINAL_TEMPERATURE, default_phases } from '#lib/constants.js';
import { initializeDatabase } from '#lib/db/index.js';
import {
	addNode,
	changePhaseAssignments,
	createProject,
	resetData
} from '#lib/db/mutations/index.js';
import { getChildNodesByParentId, getNode } from '#lib/db/queries/index.js';
import { UndoRedoState } from './undo-redo.svelte.js';

beforeAll(async () => {
	await initializeDatabase();
});

const lighting = (circuit_number: number) =>
	({
		load_type: 'LIGHTING_LOAD',
		quantity: 1,
		varies: '100',
		load_description: `L${circuit_number}`,
		continuous: false,
		circuit_number,
		length: 10,
		ambient_temperature: 30,
		terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
		config_preference: 'CUSTOM'
	}) as never;

async function project(phase: string) {
	resetData();
	const created = await createProject('Undo', { distribution_unit: 'Transformer', phase });
	return created!.root_node_id;
}

// The history itself is tested in crates/heda-core/tests/edit.rs; this is the app's view of it.
describe('UndoRedoState', () => {
	test('copyNodeById duplicates the node as one undoable edit', async () => {
		const root = await project(default_phases.ONE_PHASE);
		const undo_redo_state = new UndoRedoState();
		expect(undo_redo_state.hasUndoActions()).toBe(false);
		const { node: panel } = await addNode({
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
		expect(undo_redo_state.has_unsaved_actions).toBe(true);

		await undo_redo_state.undo();
		expect(getChildNodesByParentId(root)).toHaveLength(1);
		expect(undo_redo_state.hasRedoActions()).toBe(true);
	});

	test('undoes and redoes a rebalance of several circuits as one step', async () => {
		const root = await project(default_phases.THREE_PHASE_WYE);
		const undo_redo_state = new UndoRedoState();
		const [{ node: a }, { node: b }] = [
			await addNode({ parent_id: root, load_data: lighting(1) }),
			await addNode({ parent_id: root, load_data: lighting(3) })
		];
		await changePhaseAssignments([
			[a!.id, 'C'],
			[b!.id, 'C']
		]);
		const phases = () => [getNode(a!.id)!.phase_assignment, getNode(b!.id)!.phase_assignment];

		await undo_redo_state.undo();
		expect(phases()).toEqual([undefined, undefined]);
		await undo_redo_state.redo();
		expect(phases()).toEqual(['C', 'C']);
	});

	test('a new project starts without history', async () => {
		const root = await project(default_phases.ONE_PHASE);
		const undo_redo_state = new UndoRedoState();
		await addNode({ parent_id: root, load_data: lighting(1) });
		expect(undo_redo_state.hasUndoActions()).toBe(true);
		await project(default_phases.ONE_PHASE);
		expect(undo_redo_state.hasUndoActions()).toBe(false);
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
		await project(default_phases.ONE_PHASE);
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
