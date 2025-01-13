<script lang="ts">
	import '../app.css';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { Toaster } from '@/components/ui/sonner/index.js';
	import { setState } from '@/state/index.svelte';
	import type { DialogState } from '@/state/types';
	import { DIALOG_STATE_CTX, MISC_STATE_CTX } from '@/state/constants';
	import { setSettingsState } from '@/hooks/settings-state.svelte';
	import { setUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { setSelectNodesToDeleteState } from '@/hooks/select-nodes-to-delete.svelte';
	import { setCollapsiblesState } from '@/hooks/node-collapsibles.svelte';
	import { setProjectState } from '@/hooks/project-state.svelte';

	let { children } = $props();

	// INIT GLOBAL STATES
	setSettingsState($mode === 'light' ? 'light' : 'dark');
	setUndoRedoState();
	setSelectNodesToDeleteState();
	setCollapsiblesState();
	setProjectState();
	setState<DialogState>(
		{
			highestUnit: false
		},
		DIALOG_STATE_CTX
	);

	$effect(() => {
		document.addEventListener('contextmenu', (event) => event.preventDefault());
	});
</script>

<Toaster richColors position="top-right" />
<ModeWatcher />
{@render children?.()}
