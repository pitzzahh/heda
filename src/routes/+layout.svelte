<script lang="ts">
	import '../app.css';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { Toaster } from '@/components/ui/sonner/index.js';
	import { setState } from '@/state/index.svelte';
	import type { DialogState } from '@/state/types';
	import { DIALOG_STATE_CTX } from '@/state/constants';
	import { setSettingsState } from '@/hooks/settings-state.svelte';
	import { setUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { setSelectNodesToDeleteState } from '@/hooks/select-nodes-to-delete.svelte';
	import { setCollapsiblesState } from '@/hooks/node-collapsibles.svelte';
	import { setProjectState } from '@/hooks/project-state.svelte';
	import { warn, debug, trace, info, error } from '@tauri-apps/plugin-log';
	import { getCurrentWindow } from '@tauri-apps/api/window';

	let { children } = $props();

	// INIT GLOBAL STATES
	setSettingsState($mode === 'light' ? 'light' : 'dark');
	setUndoRedoState();
	setSelectNodesToDeleteState();
	setCollapsiblesState();
	setProjectState();
	setState<DialogState>(
		{
			highestUnit: false,
			has_unsaved_changes: false
		},
		DIALOG_STATE_CTX
	);
	function forwardConsole(
		fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
		logger: (message: string) => Promise<void>
	) {
		const original = console[fnName];
		console[fnName] = (message) => {
			original(message);
			logger(message);
		};
	}

	forwardConsole('log', trace);
	forwardConsole('debug', debug);
	forwardConsole('info', info);
	forwardConsole('warn', warn);
	forwardConsole('error', error);

	async function handleKeyDown(event: KeyboardEvent) {
		// check if f11 is pressed
		console.log(event);
		try {
			if (event.key === 'F11') {
				const win = getCurrentWindow();
				await win.setFullscreen(!win.isFullscreen);
			}
		} catch (err) {
			console.error(`Error toggling fullscreen: ${JSON.stringify(err)}`);
		}
	}
</script>

<svelte:document oncontextmenu={(e) => e.preventDefault()} />

<svelte:window onkeydown={handleKeyDown} />

<Toaster richColors position="top-right" />
<ModeWatcher />
{@render children?.()}
