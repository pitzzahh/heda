// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { syncSystemBars } from './system-bars.js';

describe('syncSystemBars', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.documentElement.style.removeProperty('--background');
	});

	test('does nothing outside the Android app (no bridge)', () => {
		expect(() => syncSystemBars(true)).not.toThrow();
	});

	test('hands Android the theme background and whether it is dark', () => {
		const set = vi.fn();
		vi.stubGlobal('HedaSystemBars', { set });
		document.documentElement.style.setProperty('--background', '#1b2422');
		syncSystemBars(true);
		// jsdom has no canvas, so the colour passes through unconverted.
		expect(set).toHaveBeenCalledWith('#1b2422', true);
		syncSystemBars(false);
		expect(set).toHaveBeenLastCalledWith('#1b2422', false);
	});
});
