// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { is_android } = vi.hoisted(() => ({ is_android: vi.fn() }));
vi.mock('#lib/helpers/platform.js', () => ({ isAndroidApp: is_android }));
vi.mock('mode-watcher', () => ({ setMode: vi.fn() }));
vi.mock('#lib/theme-colors.js', () => ({ setGlobalColorTheme: vi.fn() }));

import { SettingsState } from './settings-state.svelte.js';

beforeEach(() => {
	// jsdom has no matchMedia; the theme setup asks it for the system scheme.
	vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

afterEach(() => {
	localStorage.clear();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('SettingsState auto save default', () => {
	test('is off on desktop', () => {
		is_android.mockReturnValue(false);
		expect(new SettingsState('light').auto_save_enabled).toBe(false);
	});

	test('is on in the Android app, where a background kill drops unsaved edits', () => {
		is_android.mockReturnValue(true);
		expect(new SettingsState('light').auto_save_enabled).toBe(true);
	});

	test('keeps the choice the user saved, on Android too', () => {
		is_android.mockReturnValue(true);
		new SettingsState('light').setAutoSave(false);
		expect(new SettingsState('light').auto_save_enabled).toBe(false);
	});
});
