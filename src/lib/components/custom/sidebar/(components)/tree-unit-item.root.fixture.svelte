<script lang="ts" module>
	import type { Node } from '#lib/types/db/index.js';

	let fixture_node: Node | undefined;

	export function get_fixture_node() {
		return fixture_node as Node;
	}
</script>

<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { setSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import TreeUnitItem from './tree-unit-item.svelte';

	setSettingsState('light');
	setUndoRedoState();
	setCollapsiblesState();
	setSelectNodesToDeleteState();

	// The root of a project whose distribution unit holds a slash, the name the
	// app puts in the route.
	const node = {
		id: 'root-1',
		node_type: 'root',
		highest_unit_form: { distribution_unit: 'Utility Meter / MDU', phase: 'one_phase' }
	} as unknown as Node;

	fixture_node = node;
</script>

<Sidebar.Provider>
	<TreeUnitItem
		{node}
		highest_unit={node.highest_unit_form as NonNullable<Node['highest_unit_form']>}
		is_alt_pressed={false}
		on_copy={() => {}}
		on_delete={() => {}}
	/>
</Sidebar.Provider>
