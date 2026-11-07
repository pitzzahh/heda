import { describe, expect, it } from 'vitest';
import { convertToNormalText, formatFraction, getOptionLabel } from './index.js';

describe('formatFraction', () => {
	it('renders mixed fractions', () => {
		expect(formatFraction('1 1/2')).toBe('1 <sup>1</sup>&frasl;<sub>2</sub>');
		expect(formatFraction('7 1/2')).toBe('7 <sup>1</sup>&frasl;<sub>2</sub>');
	});

	it('renders simple fractions', () => {
		expect(formatFraction('3/4')).toBe('<sup>3</sup>&frasl;<sub>4</sub>');
	});

	it('leaves plain numbers untouched', () => {
		expect(formatFraction('28')).toBe('28');
	});

	it('escapes HTML metacharacters instead of emitting them raw', () => {
		expect(formatFraction('<img src=x onerror=alert(1)>')).toBe(
			'&lt;img src=x onerror=alert(1)&gt;'
		);
		expect(formatFraction('a&b')).toBe('a&amp;b');
	});
});

describe('getOptionLabel', () => {
	const options = [
		{ value: 'one_phase', label: '1P' },
		{ value: 'three_phase_wye', label: '3P-Y' }
	] as const;

	it('resolves a label from a canonical value', () => {
		expect(getOptionLabel(options, 'one_phase')).toBe('1P');
	});

	it('falls back to the raw value for legacy data', () => {
		expect(getOptionLabel(options, '1P')).toBe('1P');
	});

	it('renders an empty string for missing values', () => {
		expect(getOptionLabel(options, null)).toBe('');
		expect(getOptionLabel(options, undefined)).toBe('');
	});
});

describe('convertToNormalText', () => {
	it('normalizes separators and casing', () => {
		expect(convertToNormalText('LOAD_SCHEDULE')).toBe('Load schedule');
		expect(convertToNormalText('VOLTAGE_DROP', true)).toBe('Voltage drop');
	});
});
