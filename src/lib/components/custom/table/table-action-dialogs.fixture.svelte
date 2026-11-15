<script lang="ts">
	import { DataTable } from './index.js';
	import { setUndoRedoState, getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setSettingsState, getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import { onePhaseMainOrWyeCols } from './one-phase-load-cols/one-phase-main-or-wye-cols.js';
	import { getComputedLoads, getNodeById, getRootNode } from '#lib/db/queries/index.js';

	let { node_id }: { node_id: string } = $props();

	setSettingsState('dark');
	setUndoRedoState();
	setSelectNodesToDeleteState();

	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();

	function initial_loads() {
		return getComputedLoads(node_id);
	}

	function panel_node() {
		return getNodeById(node_id);
	}

	let loads = $state(initial_loads());
	const panel = panel_node();
	const highest_unit = getRootNode()?.highest_unit_form;
	const columns = onePhaseMainOrWyeCols(panel as Parameters<typeof onePhaseMainOrWyeCols>[0]);

	export function refresh() {
		loads = getComputedLoads(node_id);
	}

	export function enable_multi_copy() {
		settings_state.setIsLoadMultiCopy(true);
	}

	export function has_undo_actions() {
		return undo_redo_state.hasUndoActions();
	}
</script>

<DataTable data={loads} {columns} {highest_unit} is_footer_shown={false} />
