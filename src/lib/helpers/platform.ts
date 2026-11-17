import { isTauri } from '@tauri-apps/api/core';

/**
 * True in the Android app. A browser on an Android phone is not the app: it
 * has no file system, dialogs or back-button hook, so it stays a web build.
 */
export function isAndroidApp(): boolean {
	return isTauri() && typeof navigator !== 'undefined' && /\bAndroid\b/.test(navigator.userAgent);
}

/**
 * Phones and tablets (below lg, where modals become drawers). Nothing autofocuses
 * there: focusing a field pops the on-screen keyboard over the drawer.
 */
export function isCompactViewport(): boolean {
	// Optional: no matchMedia during prerender or in jsdom.
	return globalThis.matchMedia?.('(max-width: 1023px)').matches ?? false;
}
