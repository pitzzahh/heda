import { afterEach, describe, expect, test, vi } from 'vitest';

const { is_tauri } = vi.hoisted(() => ({ is_tauri: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: is_tauri }));

import { isAndroidApp, isCompactViewport, isPreviewVersion } from './platform.js';

const ANDROID_WEBVIEW =
	'Mozilla/5.0 (Linux; Android 16; SM-A066B Build/BP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36';
const LINUX_DESKTOP =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('isAndroidApp', () => {
	afterEach(() => vi.unstubAllGlobals());

	test('is true in the Tauri app on Android', () => {
		is_tauri.mockReturnValue(true);
		vi.stubGlobal('navigator', { userAgent: ANDROID_WEBVIEW });
		expect(isAndroidApp()).toBe(true);
	});

	test('is false in the desktop app', () => {
		is_tauri.mockReturnValue(true);
		vi.stubGlobal('navigator', { userAgent: LINUX_DESKTOP });
		expect(isAndroidApp()).toBe(false);
	});

	test('is false in a browser on an Android phone', () => {
		is_tauri.mockReturnValue(false);
		vi.stubGlobal('navigator', { userAgent: ANDROID_WEBVIEW });
		expect(isAndroidApp()).toBe(false);
	});

	test('does not match a word that only contains "Android"', () => {
		is_tauri.mockReturnValue(true);
		vi.stubGlobal('navigator', { userAgent: 'NotAndroidish/1.0' });
		expect(isAndroidApp()).toBe(false);
	});

	test('is false without a navigator (node)', () => {
		is_tauri.mockReturnValue(true);
		vi.stubGlobal('navigator', undefined);
		expect(isAndroidApp()).toBe(false);
	});
});

describe('isCompactViewport', () => {
	afterEach(() => vi.unstubAllGlobals());

	const stubWidth = (width: number) =>
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: width <= Number(/max-width: (\d+)px/.exec(query)?.[1])
		}));

	test('is true below lg (phones and tablets, where modals are drawers)', () => {
		stubWidth(384);
		expect(isCompactViewport()).toBe(true);
		stubWidth(1023);
		expect(isCompactViewport()).toBe(true);
	});

	test('is false from lg up, so desktop dialogs keep their autofocus', () => {
		stubWidth(1024);
		expect(isCompactViewport()).toBe(false);
	});

	test('is false without matchMedia (prerender, jsdom)', () => {
		vi.stubGlobal('matchMedia', undefined);
		expect(isCompactViewport()).toBe(false);
	});
});

describe('isPreviewVersion', () => {
	test('a pre-release tag marks a preview build', () => {
		expect(isPreviewVersion('2.9.0-3')).toBe(true);
		expect(isPreviewVersion('2.8.1')).toBe(false);
	});
});
