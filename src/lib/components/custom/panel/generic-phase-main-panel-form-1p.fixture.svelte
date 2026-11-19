<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { default_phases } from '#lib/constants.js';
	import GenericPhaseMainPanelForm from './generic-phase-main-panel-form.svelte';

	setUndoRedoState();
	setCollapsiblesState();
</script>

<!-- The forms hoist their actions into the dialog footer, so they need a dialog. -->
<Dialog.Root open>
	<Dialog.Content>
		<GenericPhaseMainPanelForm
			action="add"
			main_phase={default_phases.ONE_PHASE}
			parent_id="unit-1"
			selected_parent_id="unit-1"
			closeDialog={() => {}}
		/>
	</Dialog.Content>
</Dialog.Root>
