/**
 * Window-close flow. Rust prevents every close of the main window and emits
 * this event instead (see `src-tauri/src/lib.rs`); the frontend runs the
 * unsaved-changes flow and invokes `close_main_window` to actually quit.
 */
export const WINDOW_CLOSE_REQUESTED = 'window-close-requested';

/**
 * What closing the app window requires before it can proceed, given the
 * state of the project currently open in the app.
 */
export type WindowClosePlan = 'close' | 'save_then_close' | 'confirm_save';

export function planWindowCloseAction(input: {
	project_loaded: boolean;
	has_unsaved_actions: boolean;
	auto_save_enabled: boolean;
}): WindowClosePlan {
	if (!input.project_loaded || !input.has_unsaved_actions) return 'close';
	// Auto save persists on its own, so only wait for it; otherwise ask.
	return input.auto_save_enabled ? 'save_then_close' : 'confirm_save';
}
