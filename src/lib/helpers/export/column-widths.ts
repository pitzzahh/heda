import type ExcelJS from 'exceljs';

/**
 * Sizes every column to its longest value, at least `min_width` characters.
 *
 * ExcelJS rebuilds `worksheet.columns` and `column.values` on every access, so
 * each is read once: indexing `column.values[j]` inside the loop made this
 * quadratic and timed the export worker out on large projects.
 */
export function fitColumnWidths(worksheet: ExcelJS.Worksheet, min_width = 10): void {
	for (const column of worksheet.columns) {
		let width = min_width;
		for (const value of column.values ?? []) {
			width = Math.max(width, String(value ?? '').length);
		}
		column.width = width;
	}
}
