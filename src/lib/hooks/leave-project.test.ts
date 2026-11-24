import { beforeEach, describe, expect, it, vi } from 'vitest';

const { save, prompt } = vi.hoisted(() => ({ save: vi.fn(), prompt: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('#lib/db/mutations/index.js', () => ({ resetData: vi.fn() }));
vi.mock('#lib/helpers/file/index.js', () => ({ saveCurrentProject: save }));
vi.mock('#lib/state/index.svelte.js', () => ({
	getState: () => ({ promptUnsavedChanges: prompt })
}));
vi.mock('./project-state.svelte.js', () => ({
	getProjectState: () => ({ loaded: true, current_project_path: '/files/a.heda' })
}));
vi.mock('./settings-state.svelte.js', () => ({
	getSettingsState: () => ({ auto_save_enabled: true })
}));
vi.mock('./undo-redo.svelte.js', () => ({
	getUndoRedoState: () => ({ has_unsaved_actions: true, resetUnsavedActions: vi.fn() })
}));

import { createLeaveProject } from './leave-project.svelte.js';

describe('confirmLeave with auto-save on', () => {
	beforeEach(() => vi.clearAllMocks());

	it('leaves without asking once the save went through', async () => {
		save.mockResolvedValue(true);
		await expect(createLeaveProject().confirmLeave()).resolves.toBe(true);
		expect(prompt).not.toHaveBeenCalled();
	});

	it('asks when the silent save failed, so the app can still be left', async () => {
		save.mockResolvedValue(false);
		prompt.mockResolvedValue('continue');
		await expect(createLeaveProject().confirmLeave()).resolves.toBe(true);
		expect(prompt).toHaveBeenCalledTimes(1);
	});
});
