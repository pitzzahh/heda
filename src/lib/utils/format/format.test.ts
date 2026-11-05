import { describe, expect, it } from 'vitest';
import { formatFraction } from './index';

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
