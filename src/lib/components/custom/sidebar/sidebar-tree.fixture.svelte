<script lang="ts" module>
	import type { SettingsState } from '#lib/hooks/settings-state.svelte.js';

	let settings_state: SettingsState | undefined;

	export function get_fixture_settings_state() {
		return settings_state as SettingsState;
	}
</script>

<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { setSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import {
		getCollapsiblesState,
		setCollapsiblesState
	} from '#lib/hooks/node-collapsibles.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import type { Node } from '#lib/types/db/index.js';
	import SidebarTree from './sidebar-tree.svelte';

	settings_state = setSettingsState('light');
	setUndoRedoState();
	setCollapsiblesState();
	setSelectNodesToDeleteState();

	getCollapsiblesState().addNodeId('root');
	getCollapsiblesState().addNodeId('panel-1');

	const root_node = {
		id: 'root',
		node_type: 'root',
		parent_id: null,
		child_ids: ['panel-1']
	} as unknown as Node;
</script>

<Sidebar.Provider>
	<Sidebar.Content>
		<Sidebar.Menu>
			<SidebarTree
				node={root_node}
				highest_unit={{ distribution_unit: 'DU' } as unknown as NonNullable<
					Node['highest_unit_form']
				>}
			/>
		</Sidebar.Menu>
	</Sidebar.Content>
</Sidebar.Provider>
