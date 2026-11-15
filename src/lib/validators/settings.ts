import * as v from 'valibot';

export const THEME_COLOR_FIELD = v.picklist(['autocad', 'excel']);

export const FONT_FIELD = v.picklist(['isocpeur', 'verdana', 'default']);

export const THEME_MODE_FIELD = v.picklist(['dark', 'light', 'system']);

export const SETTINGS_SCHEMA = v.object({
	color: THEME_COLOR_FIELD,
	font: FONT_FIELD,
	theme_mode: THEME_MODE_FIELD,
	show_loads_on_unit_hierarchy: v.boolean(),
	is_adjustment_factor_dynamic: v.boolean(),
	is_panel_multi_copy: v.boolean(),
	is_load_multi_copy: v.boolean(),
	auto_save_enabled: v.boolean(),
	backup_project_file_if_exists: v.boolean()
});
