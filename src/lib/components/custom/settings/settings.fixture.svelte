<script lang="ts">
	import { setSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setProjectState } from '#lib/hooks/project-state.svelte.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setState } from '#lib/state/index.svelte.js';
	import { DIALOG_STATE_CTX } from '#lib/state/constants.js';
	import type { DialogState } from '#lib/state/types.js';
	import Settings from './settings.svelte';

	setSettingsState('light');
	setProjectState();
	setUndoRedoState();
	setState<DialogState>(
		{
			highestUnit: false,
			has_unsaved_changes: false,
			promptUnsavedChanges: () => Promise.resolve('cancel')
		},
		DIALOG_STATE_CTX
	);
</script>

<Settings />
