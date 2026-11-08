<script lang="ts" module>
	import type { SelectNodesToDelete } from '#lib/hooks/select-nodes-to-delete.svelte.js';

	let calls: Array<{ id: string; multi: boolean } | string> = [];
	let select_state: SelectNodesToDelete | undefined;

	export function get_calls() {
		return calls;
	}

	export function get_fixture_select_state() {
		return select_state as SelectNodesToDelete;
	}
</script>

<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { setSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import type { Node } from '#lib/types/db/index.js';
	import TreeLoadItem from './tree-load-item.svelte';

	setSettingsState('light').setShowLoadsOnUnitHeirarchy(true);
	select_state = setSelectNodesToDeleteState();

	const node = {
		id: 'load-1',
		node_type: 'load',
		load_data: { load_description: 'L1' }
	} as unknown as Node;
</script>

<Sidebar.Provider>
	<TreeLoadItem
		{node}
		highest_unit={{ distribution_unit: 'DU' } as unknown as NonNullable<Node['highest_unit_form']>}
		is_alt_pressed={true}
		on_copy={(id, multi) => calls.push({ id, multi })}
		on_delete={() => calls.push('delete')}
	/>
</Sidebar.Provider>
