import type { Font } from '@/hooks/settings-state.svelte';
export type Settings = {
  color: 'autocad' | 'excel';
  font: Font,
  show_loads_on_unit_hierarchy: boolean,
  is_adjustment_factor_dynamic: boolean,
  is_panel_multi_copy: boolean,
  is_load_multi_copy: boolean,
};
