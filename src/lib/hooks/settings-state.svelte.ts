import { PersistedState } from 'runed';
import type { Settings } from '@/types/settings';
import setGlobalColorTheme from '@/theme-colors/theme-colors';
import { setState, getState } from '@/state/index.svelte';
import { THEME_COLOR_STATE_CTX } from '@/state/constants';

export type Font = 'isocpeur' | 'verdana' | 'default';
type ThemeColor = 'autocad' | 'excel';
type ThemeMode = 'dark' | 'light';

export class SettingsState {
	persisted_state: PersistedState<Settings>;

	themeColor = $state<ThemeColor>('excel');
	font = $state<Font>('default');
	show_loads_on_unit_hierarchy = $state(false);
	is_adjustment_factor_dynamic = $state(false);
	is_panel_multi_copy = $state(false);
	is_load_multi_copy = $state(false);

	constructor(mode: ThemeMode) {
		const _persisted_state = new PersistedState<Settings>('settings', {
			color: 'excel',
			font: 'default',
			show_loads_on_unit_hierarchy: false,
			is_adjustment_factor_dynamic: false,
			is_panel_multi_copy: false,
			is_load_multi_copy: false,
		});

		this.themeColor = _persisted_state?.current?.color || 'excel';
		this.font = _persisted_state?.current?.font || 'default';
		this.show_loads_on_unit_hierarchy = _persisted_state?.current?.show_loads_on_unit_hierarchy || false;
		this.is_panel_multi_copy = _persisted_state?.current?.is_panel_multi_copy || false;
		this.is_load_multi_copy = _persisted_state?.current?.is_load_multi_copy || false
		setGlobalColorTheme(mode, _persisted_state.current.color);

		this.persisted_state = _persisted_state;
	}

	private setGlobalFont(font: Font) {
		if (typeof document !== 'undefined') {
			document.body.className = font;
		}
	}

	setThemeColor(color: ThemeColor, mode: ThemeMode) {
		const updatedData = (this.persisted_state.current = {
			...this.persisted_state.current,
			color
		});

		this.themeColor = color;
		this.persisted_state.current = updatedData;
		setGlobalColorTheme(mode, color);
	}

	setFont(font: Font) {
		const updatedData = (this.persisted_state.current = {
			...this.persisted_state.current,
			font
		});

		this.font = font;
		this.persisted_state.current = updatedData;
		this.setGlobalFont(font);
	}

	setShowLoadsOnUnitHeirarchy(show_loads_on_unit_hierarchy: boolean) {
		const updatedData = (this.persisted_state.current = {
			...this.persisted_state.current,
			show_loads_on_unit_hierarchy
		});

		this.show_loads_on_unit_hierarchy = show_loads_on_unit_hierarchy;
		this.persisted_state.current = updatedData;
	}

	setIsAdjustmentFactorDynamic(is_adjustment_factor_dynamic: boolean) {
		const updatedData = (this.persisted_state.current = {
			...this.persisted_state.current,
			is_adjustment_factor_dynamic
		});

		this.is_adjustment_factor_dynamic = is_adjustment_factor_dynamic;
		this.persisted_state.current = updatedData;
	}

	setIsPanelMultiCopy(is_panel_multi_copy: boolean) {
		const updatedData = (this.persisted_state.current = {
			...this.persisted_state.current,
			is_panel_multi_copy
		});

		this.is_panel_multi_copy = is_panel_multi_copy;
		this.persisted_state.current = updatedData;
	}

	setisLoadMultiCopy(is_load_multi_copy: boolean) {
		const updatedData = (this.persisted_state.current = {
			...this.persisted_state.current,
			is_load_multi_copy
		});

		this.is_load_multi_copy = is_load_multi_copy;
		this.persisted_state.current = updatedData;
	}
}
export function setSettingsState(mode: ThemeMode) {
	return setState(new SettingsState(mode), THEME_COLOR_STATE_CTX);
}

export function getSettingsState() {
	return getState<SettingsState>(THEME_COLOR_STATE_CTX);
}
