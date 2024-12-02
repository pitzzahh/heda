import { LocalStorage } from './storage.svelte';
import type { Settings } from '@/types/settings';
import setGlobalColorTheme from '@/theme-colors/theme-colors';
import { setState, getState } from '@/state/index.svelte';
import { THEME_COLOR_STATE_CTX } from '@/state/constants';

type Font = 'isocpeur' | 'verdana' | 'default';
type ThemeColor = 'autocad' | 'excel';
type ThemeMode = 'dark' | 'light';

export class SettingsState {
	localStorage = new LocalStorage<Settings>('settings');
	themeColor = $state<ThemeColor>(this.localStorage?.current?.color || 'excel');
	font = $state<Font>('default');

	constructor(mode: ThemeMode, font: Font) {
		$effect(() => {
			this.font = font;
			setGlobalColorTheme(mode, this.themeColor);
		});
	}

	setThemeColor(color: ThemeColor, mode: ThemeMode) {
		const updatedData = (this.localStorage.current = {
			...this.localStorage.current,
			color
		});

		this.themeColor = color;
		this.localStorage.current = updatedData;
		setGlobalColorTheme(mode, color);
	}

	setFont(font: Font) {
		const updatedData = (this.localStorage.current = {
			...this.localStorage.current,
			font
		});

		this.font = font;
		this.localStorage.current = updatedData;
	}
}
export function setSettingsState(mode: ThemeMode, font: Font) {
	return setState(new SettingsState(mode, font), THEME_COLOR_STATE_CTX);
}

export function getSettingsState() {
	return getState<ReturnType<typeof setSettingsState>>(THEME_COLOR_STATE_CTX);
}
