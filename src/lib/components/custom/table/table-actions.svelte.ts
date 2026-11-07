import { createContext } from 'svelte';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';

export type TableActionNode = VoltageDrop | PhaseLoadSchedule;

export class TableActionsState {
	node = $state<TableActionNode | null>(null);
	update_open = $state(false);
	override_open = $state(false);
	confirm_open = $state(false);
	copy_open = $state(false);
	update_parent = $state<{ name: string; id: string } | null>(null);
	on_close_menu: (() => void) | null = null;

	open_update(node: TableActionNode) {
		this.node = node;
		this.update_parent = null;
		this.update_open = true;
	}

	open_override(node: TableActionNode) {
		this.node = node;
		this.override_open = true;
	}

	open_confirm(node: TableActionNode, on_close_menu: () => void) {
		this.node = node;
		this.on_close_menu = on_close_menu;
		this.confirm_open = true;
	}

	open_copy(node: TableActionNode) {
		this.node = node;
		this.copy_open = true;
	}
}

export const [getTableActions, setTableActions] = createContext<TableActionsState>();
