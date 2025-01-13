import type { Font, ThemeMode } from '@/hooks/settings-state.svelte';
export type Settings = {
	color: 'autocad' | 'excel';
	font: Font;
	theme_mode: ThemeMode;
	show_loads_on_unit_hierarchy: boolean;
	is_adjustment_factor_dynamic: boolean;
	is_panel_multi_copy: boolean;
	is_load_multi_copy: boolean;
	is_auto_save_enabled: boolean
};
