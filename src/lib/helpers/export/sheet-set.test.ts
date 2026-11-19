import { describe, expect, it } from 'vitest';
import { localDate } from './sheet-set.js';

describe('localDate', () => {
	it('gives the local calendar date, not the UTC one', () => {
		// 07:30 local on 20 Nov: in UTC+8 that is still 19 Nov in UTC.
		expect(localDate(new Date(2026, 10, 20, 7, 30))).toBe('2026-11-20');
		expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
	});
});
