<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import GenericPhaseMainLoadForm from './generic-phase-main-load-form.svelte';

	setUndoRedoState();
	setCollapsiblesState();
</script>

<GenericPhaseMainLoadForm
	action="add"
	closeDialog={() => {}}
	panel_id_from_tree="panel-1"
	selected_parent_id="panel-1"
/>
