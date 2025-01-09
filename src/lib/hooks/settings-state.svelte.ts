import { PersistedState } from 'runed';
import type { Settings } from '@/types/settings';
import setGlobalColorTheme from '@/theme-colors/theme-colors';
import { setState, getState } from '@/state/index.svelte';
import { THEME_COLOR_STATE_CTX } from '@/state/constants';
import { setMode } from 'mode-watcher';

export type Font = 'isocpeur' | 'verdana' | 'default';
type ThemeColor = 'autocad' | 'excel';
export type ThemeMode = 'dark' | 'light' | 'system';

export class SettingsState {
	persisted_state: PersistedState<Settings>;

	themeColor = $state<ThemeColor>('excel');
	themeMode = $state<ThemeMode>('light');
	font = $state<Font>('default');
	show_loads_on_unit_hierarchy = $state(false);
	is_adjustment_factor_dynamic = $state(false);
	is_panel_multi_copy = $state(false);
	is_load_multi_copy = $state(false);

	constructor() {
		const _persisted_state = new PersistedState<Settings>('settings', {
			color: 'excel',
			font: 'default',
			show_loads_on_unit_hierarchy: false,
			is_adjustment_factor_dynamic: false,
			is_panel_multi_copy: false,
			is_load_multi_copy: false,
			theme_mode: 'light'
		});

		// must be set before calling setters
		this.persisted_state = _persisted_state;

		this.setThemeColor(
			_persisted_state?.current?.color || 'excel',
			_persisted_state.current.theme_mode || 'light'
		);
		this.setThemeMode(_persisted_state.current.theme_mode || 'light');
		this.setGlobalFont(_persisted_state?.current?.font ?? 'default');
		this.setShowLoadsOnUnitHeirarchy(
			_persisted_state?.current?.show_loads_on_unit_hierarchy || false
		);
		this.setIsAdjustmentFactorDynamic(
			_persisted_state?.current?.is_adjustment_factor_dynamic || false
		);
		this.setIsPanelMultiCopy(_persisted_state?.current?.is_panel_multi_copy || false);
		this.setIsLoadMultiCopy(_persisted_state?.current?.is_load_multi_copy || false);
	}

	private setGlobalFont(font: Font) {
		if (typeof document !== 'undefined') {
			document.body.className = font;
		}
	}

	private setGlobalThemeMode(mode: ThemeMode) {
		const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		if (mode === 'system') {
			setGlobalColorTheme(systemPrefersDark ? 'dark' : 'light', this.themeColor);
			setMode(systemPrefersDark ? 'dark' : 'light');
		} else {
			setGlobalColorTheme(mode, this.themeColor);
			setMode(mode);
		}
	}

	setThemeColor(color: ThemeColor, mode: ThemeMode) {
		this.themeColor = color;
		this.persisted_state.current = {
			...this.persisted_state.current,
			color
		};
		setGlobalColorTheme(mode, color);
	}

	setFont(font: Font) {
		this.font = font;
		this.setGlobalFont(font);
		this.persisted_state.current = {
			...this.persisted_state.current,
			font
		};
	}

	setThemeMode(mode: ThemeMode) {
		this.themeMode = mode;
		this.setGlobalThemeMode(mode);
		this.persisted_state.current = {
			...this.persisted_state.current,
			theme_mode: mode
		};
	}

	setShowLoadsOnUnitHeirarchy(show_loads_on_unit_hierarchy: boolean) {
		this.show_loads_on_unit_hierarchy = show_loads_on_unit_hierarchy;
		this.persisted_state.current = {
			...this.persisted_state.current,
			show_loads_on_unit_hierarchy
		};
	}

	setIsAdjustmentFactorDynamic(is_adjustment_factor_dynamic: boolean) {
		this.is_adjustment_factor_dynamic = is_adjustment_factor_dynamic;
		this.persisted_state.current = {
			...this.persisted_state.current,
			is_adjustment_factor_dynamic
		};
	}

	setIsPanelMultiCopy(is_panel_multi_copy: boolean) {
		this.is_panel_multi_copy = is_panel_multi_copy;
		this.persisted_state.current = {
			...this.persisted_state.current,
			is_panel_multi_copy
		};
	}

	setIsLoadMultiCopy(is_load_multi_copy: boolean) {
		this.is_load_multi_copy = is_load_multi_copy;
		this.persisted_state.current = {
			...this.persisted_state.current,
			is_load_multi_copy
		};
	}
}
export function setSettingsState(mode: ThemeMode) {
	return setState(new SettingsState(), THEME_COLOR_STATE_CTX);
}

export function getSettingsState() {
	return getState<SettingsState>(THEME_COLOR_STATE_CTX);
}
