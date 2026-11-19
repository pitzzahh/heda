<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import GenericPhaseMainLoadForm from './generic-phase-main-load-form.svelte';

	setUndoRedoState();
	setCollapsiblesState();
</script>

<!-- The forms hoist their actions into the dialog footer, so they need a dialog. -->
<Dialog.Root open>
	<Dialog.Content>
		<GenericPhaseMainLoadForm
			action="add"
			closeDialog={() => {}}
			panel_id_from_tree="panel-1"
			selected_parent_id="panel-1"
		/>
	</Dialog.Content>
</Dialog.Root>
