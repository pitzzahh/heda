// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';

const { exceljs_import, generate_workbook } = vi.hoisted(() => ({
	exceljs_import: vi.fn(),
	generate_workbook: vi.fn()
}));

vi.mock('exceljs', () => {
	exceljs_import();
	return { default: { Workbook: class Workbook {} } };
});

vi.mock('svelte-sonner', () => ({
	toast: { warning: vi.fn(), info: vi.fn(), success: vi.fn() }
}));

vi.mock('#lib/db/queries/snapshot.js', () => ({
	loadSnapshot: () => ({ nodes: [], is_dynamic: false })
}));

vi.mock('#lib/workers/export-client.js', () => ({
	generateWorkbookInWorker: generate_workbook
}));

import { exportToExcel } from './index.js';

describe('export laziness', () => {
	test('exceljs stays in the worker, never on the main thread', async () => {
		expect(exceljs_import).not.toHaveBeenCalled();

		generate_workbook.mockResolvedValueOnce({ buffer: new ArrayBuffer(0), title: 'test' });
		URL.createObjectURL = vi.fn(() => 'blob:test');
		URL.revokeObjectURL = vi.fn();
		HTMLAnchorElement.prototype.click = vi.fn();

		await exportToExcel('LOAD_SCHEDULE', 'missing-node', {
			phase: 'three_phase_wye'
		} as never);

		expect(generate_workbook).toHaveBeenCalledTimes(1);
		expect(exceljs_import).not.toHaveBeenCalled();
	});
});
