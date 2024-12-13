import { LocalStorage } from './storage.svelte';
import type { Settings } from '@/types/settings';
import setGlobalColorTheme from '@/theme-colors/theme-colors';
import { setState, getState } from '@/state/index.svelte';
import { THEME_COLOR_STATE_CTX } from '@/state/constants';

export type Font = 'isocpeur' | 'verdana' | 'default';
type ThemeColor = 'autocad' | 'excel';
type ThemeMode = 'dark' | 'light';

export class SettingsState {
	localStorage: LocalStorage<Settings>;

	themeColor = $state<ThemeColor>('excel');
	font = $state<Font>('default');

	constructor(mode: ThemeMode) {
		const localStorage = new LocalStorage<Settings>('settings');

		setGlobalColorTheme(mode, localStorage?.current?.color || 'excel');
		this.setGlobalFont(localStorage?.current?.font || 'default');
		this.localStorage = localStorage;
	}

	private setGlobalFont(font: Font) {
		if (typeof document !== 'undefined') {
			document.body.className = font;
		}
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
		this.setGlobalFont(font);
	}
}
export function setSettingsState(mode: ThemeMode) {
	return setState(new SettingsState(mode), THEME_COLOR_STATE_CTX);
}

export function getSettingsState() {
	return getState<ReturnType<typeof setSettingsState>>(THEME_COLOR_STATE_CTX);
}
