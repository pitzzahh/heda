// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';

const { exists } = vi.hoisted(() => ({ exists: vi.fn() }));
vi.mock('#lib/helpers/file/index.js', () => ({ allowProjectFolder: exists }));

import { ProjectState } from './project-state.svelte.js';

const saved = (id: string, exists = true) => ({
	id,
	project_name: id,
	project_path: `/files/${id}.heda`,
	exists
});

afterEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
});

describe('ProjectState.validateRecentProjects', () => {
	test('keeps a project added while the disk checks run', async () => {
		localStorage.setItem(
			'project_state',
			JSON.stringify({ recent_projects: [saved('a'), saved('b')], loaded: false })
		);
		let release: (() => void) | undefined;
		const gate = new Promise<void>((resolve) => (release = resolve));
		exists.mockImplementation(async (path: string) => {
			await gate;
			return path !== '/files/b.heda';
		});

		const state = new ProjectState();
		state.addRecentProject(saved('c'));
		release?.();
		await vi.waitFor(() => expect(state.recent_projects?.[1].exists).toBe(false));

		expect(state.recent_projects?.map(({ id, exists }) => [id, exists])).toEqual([
			['a', true],
			['b', false],
			['c', true]
		]);
	});

	test('keeps the last known state when a check throws', async () => {
		localStorage.setItem(
			'project_state',
			JSON.stringify({ recent_projects: [saved('a', true)], loaded: false })
		);
		exists.mockRejectedValue(new Error('forbidden path'));

		const state = new ProjectState();
		await state.validateRecentProjects();

		expect(state.recent_projects?.[0].exists).toBe(true);
	});
});
