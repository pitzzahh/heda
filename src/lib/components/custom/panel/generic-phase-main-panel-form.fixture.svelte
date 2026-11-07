<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { default_phases } from '#lib/constants/index.js';
	import GenericPhaseMainPanelForm from './generic-phase-main-panel-form.svelte';

	setUndoRedoState();
	setCollapsiblesState();
</script>

<GenericPhaseMainPanelForm
	action="add"
	main_phase={default_phases.THREE_PHASE_WYE}
	parent_id="unit-1"
	selected_parent_id="unit-1"
	closeDialog={() => {}}
/>
