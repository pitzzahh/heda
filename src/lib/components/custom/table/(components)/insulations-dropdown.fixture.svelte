<script lang="ts" module>
	import type { UndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let fixture_state: UndoRedoState | undefined;

	export function get_fixture_state() {
		return fixture_state as UndoRedoState;
	}
</script>

<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
	import InsulationsDropdown from './insulations-dropdown.svelte';

	fixture_state = setUndoRedoState();
</script>

<InsulationsDropdown
	adjusted_current={150}
	type="conductor"
	current_insulation="TW-Cu"
	node={{ id: 'node-a' } as unknown as PhaseLoadSchedule}
/>
