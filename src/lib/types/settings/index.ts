import type { Font } from '@/hooks/settings-state.svelte';
export type Settings = { color: 'autocad' | 'excel'; font: Font, show_loads_on_unit_hierarchy: boolean };
