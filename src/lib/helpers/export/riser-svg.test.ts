import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportRiserSvg } from './riser-svg.js';

const mocked = vi.hoisted(() => ({
	save: vi.fn(),
	writeFile: vi.fn(),
	engineFile: vi.fn(),
	getRiserAsync: vi.fn(),
	toast: { success: vi.fn(), error: vi.fn() }
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: mocked.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: mocked.writeFile }));
vi.mock('svelte-sonner', () => ({ toast: mocked.toast }));
vi.mock('#lib/core/api.js', () => ({ engineFile: mocked.engineFile }));
vi.mock('#lib/db/queries/riser.js', () => ({ getRiserAsync: mocked.getRiserAsync }));
vi.mock('#lib/helpers/file/reveal.js', () => ({ showInFolderAction: () => undefined }));

const bytes = new Uint8Array([60, 115, 118, 103]);

describe('exportRiserSvg', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocked.engineFile.mockResolvedValue(bytes);
	});

	it("names the file after the engine's layout and saves the engine's SVG of that node", async () => {
		// The screen may still show the old title; the engine has the rename.
		mocked.getRiserAsync.mockResolvedValue({ boxes: [{ title: 'MDP-renamed' }] });
		mocked.save.mockResolvedValue('/tmp/out.svg');
		await exportRiserSvg('node-1');
		expect(mocked.getRiserAsync).toHaveBeenCalledWith('node-1');
		expect(mocked.save).toHaveBeenCalledWith(
			expect.objectContaining({ defaultPath: 'MDP-renamed Riser Diagram.svg' })
		);
		expect(mocked.engineFile).toHaveBeenCalledWith('riser_svg', { node_id: 'node-1' });
		expect(mocked.writeFile).toHaveBeenCalledWith('/tmp/out.svg', bytes);
		expect(mocked.toast.success).toHaveBeenCalled();
	});

	it('says the panel is gone instead of failing when it was deleted', async () => {
		mocked.getRiserAsync.mockResolvedValue(null);
		await exportRiserSvg('gone');
		expect(mocked.toast.error).toHaveBeenCalledWith('Nothing to save: this panel was deleted.');
		expect(mocked.save).not.toHaveBeenCalled();
		expect(mocked.engineFile).not.toHaveBeenCalled();
	});

	it('writes nothing when the save dialog is cancelled', async () => {
		mocked.getRiserAsync.mockResolvedValue({ boxes: [] });
		mocked.save.mockResolvedValue(null);
		await exportRiserSvg('node-1');
		expect(mocked.save).toHaveBeenCalledWith(
			expect.objectContaining({ defaultPath: 'Project Riser Diagram.svg' })
		);
		expect(mocked.engineFile).not.toHaveBeenCalled();
		expect(mocked.writeFile).not.toHaveBeenCalled();
	});
});
