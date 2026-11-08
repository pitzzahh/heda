<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { setSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import type { Node } from '#lib/types/db/index.js';
	import TreeUnitItem from './tree-unit-item.svelte';

	setSettingsState('light');
	setUndoRedoState();
	setCollapsiblesState();
	setSelectNodesToDeleteState();

	const node = {
		id: 'panel-1',
		node_type: 'panel',
		panel_data: { name: 'LP-A' },
		highest_unit_form: { phase: 'one_phase' }
	} as unknown as Node;
</script>

<Sidebar.Provider>
	<TreeUnitItem
		{node}
		highest_unit={{ distribution_unit: 'DU' } as unknown as NonNullable<Node['highest_unit_form']>}
		is_alt_pressed={false}
		on_copy={() => {}}
		on_delete={() => {}}
	/>
</Sidebar.Provider>
