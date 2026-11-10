import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { invoke } from '@tauri-apps/api/core';
import { getState } from '#lib/state/index.svelte.js';
import { DIALOG_STATE_CTX } from '#lib/state/constants.js';
import type { DialogState } from '#lib/state/types.js';
import { resetData } from '#lib/db/mutations/index.js';
import { saveCurrentProject } from '#lib/helpers/file/index.js';
import { planWindowCloseAction } from '#lib/helpers/file/close-request.js';
import { getProjectState } from './project-state.svelte.js';
import { getSettingsState } from './settings-state.svelte.js';
import { getUndoRedoState } from './undo-redo.svelte.js';

/**
 * Shared "leave the current project" flow used by the sidebar Home button,
 * Settings, and the system window-close request. With auto-save on, waits
 * for the queued write; with it off, asks via the shared unsaved-changes
 * dialog. `before_prompt` runs right before the prompt opens (e.g. to close
 * the Settings dialog first).
 */
export function createLeaveProject() {
	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();
	const project_state = getProjectState();
	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);

	function resetSession() {
		// Unsaved changes belong to the project being left. Clearing the flag
		// stops a pending auto-save from firing against the reset database.
		undo_redo_state.resetUnsavedActions();
		resetData();
	}

	async function confirmLeave(before_prompt?: () => void): Promise<boolean> {
		const plan = planWindowCloseAction({
			project_loaded: project_state.loaded,
			has_unsaved_actions: undo_redo_state.has_unsaved_actions,
			auto_save_enabled: settings_state.auto_save_enabled
		});
		if (plan === 'close') return true;

		if (plan === 'save_then_close') {
			return saveCurrentProject(project_state.current_project_path, undo_redo_state);
		}

		before_prompt?.();
		const decision = await dialogs_state.promptUnsavedChanges();
		if (decision === 'cancel') return false;
		if (decision === 'save') {
			return saveCurrentProject(project_state.current_project_path, undo_redo_state);
		}
		return true;
	}

	async function goHome(before_prompt?: () => void): Promise<void> {
		if (!(await confirmLeave(before_prompt))) return;
		resetSession();
		await goto(resolve('/'));
	}

	/** System close button / Alt+F4: Rust prevented the close, so quit here. */
	async function closeApp(): Promise<void> {
		if (!(await confirmLeave())) return;
		await invoke('close_main_window');
	}

	return { confirmLeave, resetSession, goHome, closeApp };
}
