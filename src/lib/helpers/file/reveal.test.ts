// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { is_tauri, reveal_item_in_dir, toast_warning } = vi.hoisted(() => ({
	is_tauri: vi.fn(),
	reveal_item_in_dir: vi.fn(),
	toast_warning: vi.fn()
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: is_tauri }));
vi.mock('@tauri-apps/plugin-opener', () => ({ revealItemInDir: reveal_item_in_dir }));
vi.mock('svelte-sonner', () => ({ toast: { warning: toast_warning } }));

import { revealInFileManager, showInFolderAction } from './reveal.js';

describe('revealInFileManager', () => {
	beforeEach(() => vi.clearAllMocks());

	test('does nothing on the web', async () => {
		is_tauri.mockReturnValue(false);
		await revealInFileManager('/tmp/report.xlsx');
		expect(reveal_item_in_dir).not.toHaveBeenCalled();
	});

	test('reveals the file in the OS file manager on desktop', async () => {
		is_tauri.mockReturnValue(true);
		reveal_item_in_dir.mockResolvedValue(undefined);
		await revealInFileManager('/tmp/report.xlsx');
		expect(reveal_item_in_dir).toHaveBeenCalledWith('/tmp/report.xlsx');
		expect(toast_warning).not.toHaveBeenCalled();
	});

	test('shows the path when the file manager cannot be opened', async () => {
		is_tauri.mockReturnValue(true);
		reveal_item_in_dir.mockRejectedValue(new Error('no file manager'));
		await revealInFileManager('/tmp/report.xlsx');
		expect(toast_warning).toHaveBeenCalledWith('Could not open the file manager', {
			description: 'The file is saved at /tmp/report.xlsx.'
		});
	});

	test('showInFolderAction reveals its bound path', async () => {
		is_tauri.mockReturnValue(true);
		reveal_item_in_dir.mockResolvedValue(undefined);
		const action = showInFolderAction('/tmp/project.heda');
		expect(action.label).toBe('Show in folder');
		await action.onClick();
		expect(reveal_item_in_dir).toHaveBeenCalledWith('/tmp/project.heda');
	});
});
