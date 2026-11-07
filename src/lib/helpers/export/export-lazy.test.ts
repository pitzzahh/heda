import { describe, expect, test, vi } from 'vitest';

const { exceljs_import } = vi.hoisted(() => ({ exceljs_import: vi.fn() }));

vi.mock('exceljs', () => {
	exceljs_import();
	return { default: { Workbook: class Workbook {} } };
});

vi.mock('svelte-sonner', () => ({
	toast: { warning: vi.fn(), info: vi.fn(), success: vi.fn() }
}));

import { exportToExcel } from './index.js';

describe('export laziness', () => {
	test('exceljs loads on export, not on import', async () => {
		expect(exceljs_import).not.toHaveBeenCalled();
		await exportToExcel('LOAD_SCHEDULE', 'missing-node', {
			phase: 'three_phase_wye'
		} as never);
		expect(exceljs_import).toHaveBeenCalledTimes(1);
	});
});
