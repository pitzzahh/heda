import { beforeEach, describe, expect, it, vi } from 'vitest';

const { save, prompt, settled, state } = vi.hoisted(() => ({
	save: vi.fn(),
	prompt: vi.fn(),
	settled: vi.fn(),
	state: { has_unsaved_actions: true }
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('#lib/db/mutations/index.js', () => ({ resetData: vi.fn() }));
vi.mock('#lib/db/index.js', () => ({ settled }));
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
	getUndoRedoState: () => ({
		get has_unsaved_actions() {
			return state.has_unsaved_actions;
		},
		resetUnsavedActions: vi.fn()
	})
}));

import { createLeaveProject } from './leave-project.svelte.js';

describe('confirmLeave with auto-save on', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		state.has_unsaved_actions = true;
		settled.mockResolvedValue(undefined);
	});

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

describe('confirmLeave right after an edit', () => {
	beforeEach(() => vi.clearAllMocks());

	it('waits for the engine to answer the edit before deciding, so it is saved', async () => {
		// The edit is still in flight: the unsaved flag turns on only when it answers.
		state.has_unsaved_actions = false;
		settled.mockImplementation(async () => {
			state.has_unsaved_actions = true;
		});
		save.mockResolvedValue(true);
		await expect(createLeaveProject().confirmLeave()).resolves.toBe(true);
		expect(save).toHaveBeenCalledTimes(1);
	});
});
