import { SettingsState } from '#lib/hooks/settings-state.svelte.js';
import { UndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
import { SelectNodesToDelete } from '#lib/hooks/select-nodes-to-delete.svelte.js';
import { Collapsibles } from '#lib/hooks/node-collapsibles.svelte.js';
import type { ProjectState } from '#lib/hooks/project-state.svelte.js';
import type { FileOpenState } from '#lib/hooks/file-open.svelte.js';

export type State =
	| DialogState
	| SettingsState
	| UndoRedoState
	| SelectNodesToDelete
	| ProjectState
	| Collapsibles
	| FileOpenState;

export type UnsavedDecision = 'cancel' | 'continue' | 'save';

export type DialogState = {
	highestUnit: boolean;
	has_unsaved_changes: boolean;
	/** Opens the shared unsaved-changes dialog and resolves with the choice. */
	promptUnsavedChanges: () => Promise<UnsavedDecision>;
};
