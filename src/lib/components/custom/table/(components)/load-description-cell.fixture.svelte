<script lang="ts" module>
	import type { UndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let fixture_state: UndoRedoState | undefined;

	export function get_fixture_state() {
		return fixture_state as UndoRedoState;
	}
</script>

<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import LoadDescriptionCell from './load-description-cell.svelte';

	let { node_type, load_description }: { node_type: 'panel' | 'load'; load_description: string } =
		$props();

	fixture_state = setUndoRedoState();
</script>

<LoadDescriptionCell node_id="node-a" {node_type} {load_description} />
