import { describe, expect, it } from 'vitest';
import { localDate, titleBlockChanged } from './sheet-set.js';

describe('localDate', () => {
	it('gives the local calendar date, not the UTC one', () => {
		// 07:30 local on 20 Nov: in UTC+8 that is still 19 Nov in UTC.
		expect(localDate(new Date(2026, 10, 20, 7, 30))).toBe('2026-11-20');
		expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
	});
});

describe('titleBlockChanged', () => {
	it('ignores key order', () => {
		expect(
			titleBlockChanged(
				{ sheet_size: 'A3', location: 'Cebu', tin: '1' },
				{ location: 'Cebu', tin: '1', sheet_size: 'A3' }
			)
		).toBe(false);
	});

	it('sees a changed, added or removed field', () => {
		expect(titleBlockChanged({ location: 'Cebu' }, { location: 'Lahug' })).toBe(true);
		expect(titleBlockChanged({ location: 'Cebu' }, { location: 'Cebu', tin: '1' })).toBe(true);
		expect(titleBlockChanged({ location: 'Cebu', tin: '1' }, { location: 'Cebu' })).toBe(true);
		expect(titleBlockChanged(undefined, { sheet_size: '760x1000' })).toBe(true);
	});
});
