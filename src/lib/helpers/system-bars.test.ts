// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { syncSystemBars, watchSafeArea } from './system-bars.js';

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

describe('watchSafeArea', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		document.documentElement.removeAttribute('style');
	});

	test('leaves the insets alone outside the Android app', () => {
		watchSafeArea()();
		expect(document.documentElement.style.getPropertyValue('--safe-area-top')).toBe('');
	});

	test('mirrors the shell insets and follows changes until stopped', () => {
		let insets = '{"top":24,"right":0,"bottom":0,"left":32}';
		vi.stubGlobal('HedaSystemBars', { set: vi.fn(), safeArea: () => insets });
		const stop = watchSafeArea();
		const style = document.documentElement.style;
		expect(style.getPropertyValue('--safe-area-top')).toBe('24px');
		expect(style.getPropertyValue('--safe-area-left')).toBe('32px');
		expect(style.getPropertyValue('--safe-area-bottom')).toBe('0px');
		insets = '{"top":0,"right":0,"bottom":0,"left":0}';
		window.dispatchEvent(new Event('heda-safe-area'));
		expect(style.getPropertyValue('--safe-area-left')).toBe('0px');
		stop();
		insets = '{"top":9,"right":0,"bottom":0,"left":0}';
		window.dispatchEvent(new Event('heda-safe-area'));
		expect(style.getPropertyValue('--safe-area-top')).toBe('0px');
	});
});
