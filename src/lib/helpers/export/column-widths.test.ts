import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { fitColumnWidths } from './column-widths.js';

describe('fitColumnWidths', () => {
	it('sizes each column to its longest value, never under the minimum', () => {
		const sheet = new ExcelJS.Workbook().addWorksheet('S');
		sheet.getCell('A1').value = 'Header';
		sheet.getCell('A2').value = 'A considerably longer value';
		sheet.getCell('B1').value = 'B';
		sheet.getCell('B3').value = 12345;
		sheet.getCell('C2').value = 'exactly 12 c';

		fitColumnWidths(sheet);

		expect(sheet.columns.map((column) => column.width)).toEqual([27, 10, 12]);
	});

	it('stays fast on a large sheet', () => {
		const sheet = new ExcelJS.Workbook().addWorksheet('S');
		for (let row = 1; row <= 5000; row += 1) {
			sheet.getRow(row).values = Array.from({ length: 15 }, (_, i) => `row-${row}-col-${i}`);
		}
		const started = performance.now();
		fitColumnWidths(sheet);
		// The old per-cell `column.values` read took minutes at this size.
		expect(performance.now() - started).toBeLessThan(2000);
		expect(sheet.getColumn(15).width).toBe('row-5000-col-14'.length);
	});
});
