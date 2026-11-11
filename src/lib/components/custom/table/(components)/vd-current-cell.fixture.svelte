<script lang="ts" module>
	import type { UndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let fixture_state: UndoRedoState | undefined;

	export function get_fixture_state() {
		return fixture_state as UndoRedoState;
	}
</script>

<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';
	import VdCurrentCell from './vd-current-cell.svelte';

	fixture_state = setUndoRedoState();
</script>

<Tooltip.Provider>
	<VdCurrentCell
		current={20}
		is_at_used={false}
		node={{ id: 'node-a', parent_id: 'root', current: 20, at: 30 } as unknown as VoltageDrop}
	/>
</Tooltip.Provider>
