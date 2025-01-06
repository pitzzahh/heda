import type { SettingsState } from "@/hooks/settings-state.svelte";
import { setMode } from "mode-watcher";

export function setModeAndColor(settingsState: SettingsState, mode: 'dark' | 'light' | 'system') {
  settingsState.setThemeColor(settingsState.themeColor, mode);
  setMode(mode);
}
