import { untrack } from 'svelte';
import { getState, setState } from '#lib/state/index.svelte.js';
import { UNDO_REDO_STATE_CTX } from '#lib/state/constants.js';
import { getHistory, onEdit, onHistory } from '#lib/db/index.js';
import { copyAndAddNodeById, redoEdit, undoEdit } from '#lib/db/mutations/nodes.js';
import type { HistoryDepth } from '#lib/types/db.js';

/**
 * Undo and redo of the open project, and whether it has unsaved edits. The history
 * itself lives in the engine (`Session::commit`); this only mirrors its depth.
 */
export class UndoRedoState {
	private history = $state<HistoryDepth>(getHistory());

	has_unsaved_actions = $state(false);
	/** Bumped on every edit so a save can tell whether newer edits landed while it wrote. */
	edit_version = $state(0);

	constructor() {
		// App-lifetime state: one instance per window, so the listeners are never removed.
		onHistory(() => (this.history = getHistory()));
		onEdit(() => this.setHasUnsavedActions());
	}

	/** Pass the `edit_version` a save snapshotted; the flag only clears if nothing changed since. */
	resetUnsavedActions(saved_version?: number) {
		if (saved_version !== undefined && saved_version !== this.edit_version) return;
		this.has_unsaved_actions = false;
	}

	/** Marks an edit the engine does not record (the project, the unit form, sheet settings). */
	setHasUnsavedActions() {
		// Untracked read: effects call this, and tracking the counter would re-run them forever.
		this.edit_version = untrack(() => this.edit_version) + 1;
		this.has_unsaved_actions = true;
	}

	copyNodeById(node_id: string) {
		return copyAndAddNodeById(node_id);
	}

	hasUndoActions() {
		return this.history.undo > 0;
	}

	hasRedoActions() {
		return this.history.redo > 0;
	}

	undo() {
		return undoEdit();
	}

	redo() {
		return redoEdit();
	}
}

export function setUndoRedoState() {
	return setState(new UndoRedoState(), UNDO_REDO_STATE_CTX);
}

export function getUndoRedoState() {
	return getState<ReturnType<typeof setUndoRedoState>>(UNDO_REDO_STATE_CTX);
}
