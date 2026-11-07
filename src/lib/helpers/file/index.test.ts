import { describe, expect, it, vi } from 'vitest';

const { open_mock, write_mock, close_mock } = vi.hoisted(() => ({
	open_mock: vi.fn(),
	write_mock: vi.fn(),
	close_mock: vi.fn()
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
	BaseDirectory: { Document: 1 },
	exists: vi.fn(),
	open: open_mock,
	readFile: vi.fn()
}));

import { writeEncryptedFile } from './index.js';

describe('writeEncryptedFile', () => {
	it('truncates on overwrite so no stale tail survives', async () => {
		open_mock.mockResolvedValue({ write: write_mock, close: close_mock });
		await writeEncryptedFile({ a: 1 }, 'pw', '/tmp/x.heda');
		expect(open_mock).toHaveBeenCalledWith(
			'/tmp/x.heda',
			expect.objectContaining({ truncate: true })
		);
	});

	it('creates new files exclusively', async () => {
		open_mock.mockResolvedValue({ write: write_mock, close: close_mock });
		await writeEncryptedFile({ a: 1 }, 'pw', '/tmp/x.heda', true);
		expect(open_mock).toHaveBeenCalledWith(
			'/tmp/x.heda',
			expect.objectContaining({ createNew: true, truncate: true })
		);
	});
});
