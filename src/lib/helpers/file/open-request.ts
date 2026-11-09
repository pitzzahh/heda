/** Event emitted by Rust (`src-tauri/src/lib.rs`) when the OS opens a `.heda` file. */
export const FILE_OPEN_EVENT = 'file-open-request';

/**
 * What opening an OS-delivered `.heda` file requires before the load can start,
 * given the state of the project currently open in the app.
 */
export type FileOpenPlan = 'load' | 'save_then_load' | 'confirm_save';

export function planFileOpenAction(input: {
	project_loaded: boolean;
	has_unsaved_actions: boolean;
	auto_save_enabled: boolean;
}): FileOpenPlan {
	if (!input.project_loaded || !input.has_unsaved_actions) return 'load';
	// Auto save persists on its own, so only wait for it; otherwise ask.
	return input.auto_save_enabled ? 'save_then_load' : 'confirm_save';
}
