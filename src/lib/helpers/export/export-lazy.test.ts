// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { exceljs_import, generate_workbook, is_tauri, save_dialog, write_file, toast_success } =
	vi.hoisted(() => ({
		exceljs_import: vi.fn(),
		generate_workbook: vi.fn(),
		is_tauri: vi.fn(),
		save_dialog: vi.fn(),
		write_file: vi.fn(),
		toast_success: vi.fn()
	}));

vi.mock('exceljs', () => {
	exceljs_import();
	return { default: { Workbook: class Workbook {} } };
});

vi.mock('svelte-sonner', () => ({
	toast: { warning: vi.fn(), info: vi.fn(), success: toast_success }
}));

vi.mock('@tauri-apps/api/core', () => ({ isTauri: is_tauri }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: save_dialog }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: write_file }));

vi.mock('#lib/db/queries/export.js', () => ({
	getExportInputs: async () => ({ nodes: [], rows: {}, voltage_drops: [] })
}));

vi.mock('#lib/workers/export-client.js', () => ({
	generateWorkbookInWorker: generate_workbook
}));

import { exportToExcel } from './index.js';

describe('export laziness', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		is_tauri.mockReturnValue(false);
		URL.createObjectURL = vi.fn(() => 'blob:test');
		URL.revokeObjectURL = vi.fn();
		HTMLAnchorElement.prototype.click = vi.fn();
	});

	test('exceljs stays in the worker, never on the main thread', async () => {
		expect(exceljs_import).not.toHaveBeenCalled();

		generate_workbook.mockResolvedValueOnce({ buffer: new ArrayBuffer(0), title: 'test' });
		await exportToExcel('LOAD_SCHEDULE', 'missing-node', {
			phase: 'three_phase_wye'
		} as never);

		expect(generate_workbook).toHaveBeenCalledTimes(1);
		expect(exceljs_import).not.toHaveBeenCalled();
		expect(save_dialog).not.toHaveBeenCalled();
	});

	test('desktop export writes to the chosen path and offers to reveal it', async () => {
		is_tauri.mockReturnValue(true);
		save_dialog.mockResolvedValue('/tmp/chosen.xlsx');
		write_file.mockResolvedValue(undefined);
		generate_workbook.mockResolvedValueOnce({ buffer: new ArrayBuffer(8), title: 'Chosen' });

		await exportToExcel('LOAD_SCHEDULE', 'missing-node', {
			phase: 'three_phase_wye'
		} as never);

		expect(save_dialog).toHaveBeenCalledWith({
			defaultPath: 'Chosen.xlsx',
			filters: [{ name: 'Excel workbook', extensions: ['xlsx'] }]
		});
		expect(write_file).toHaveBeenCalledWith('/tmp/chosen.xlsx', expect.any(Uint8Array));
		expect(toast_success).toHaveBeenCalledWith(
			'Export finished successfully.',
			expect.objectContaining({
				description: '/tmp/chosen.xlsx',
				action: expect.objectContaining({ label: 'Show in folder' })
			})
		);
		expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
	});

	test('desktop export cancelled at the dialog writes nothing', async () => {
		is_tauri.mockReturnValue(true);
		save_dialog.mockResolvedValue(null);
		generate_workbook.mockResolvedValueOnce({ buffer: new ArrayBuffer(8), title: 'Chosen' });

		await exportToExcel('LOAD_SCHEDULE', 'missing-node', {
			phase: 'three_phase_wye'
		} as never);

		expect(write_file).not.toHaveBeenCalled();
		expect(toast_success).not.toHaveBeenCalled();
	});
});
