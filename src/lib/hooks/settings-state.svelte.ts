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
	themeColor = $state<ThemeColor>('excel');
	font = $state<Font>('default');

	constructor(color: ThemeColor, mode: ThemeMode, font: Font) {
		$effect(() => {
			this.themeColor = color;
			this.font = font;
			setGlobalColorTheme(mode, color);
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
export function setSettingsState(color: ThemeColor, mode: ThemeMode, font: Font) {
	return setState(new SettingsState(color, mode, font), THEME_COLOR_STATE_CTX);
}

export function getSettingsState() {
	return getState<ReturnType<typeof setSettingsState>>(THEME_COLOR_STATE_CTX);
}
