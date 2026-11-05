import type * as v from 'valibot';
import type {
	FONT_FIELD,
	SETTINGS_SCHEMA,
	THEME_COLOR_FIELD,
	THEME_MODE_FIELD
} from '#lib/validators/settings';

export type ThemeColor = v.InferOutput<typeof THEME_COLOR_FIELD>;
export type Font = v.InferOutput<typeof FONT_FIELD>;
export type ThemeMode = v.InferOutput<typeof THEME_MODE_FIELD>;
export type Settings = v.InferOutput<typeof SETTINGS_SCHEMA>;
