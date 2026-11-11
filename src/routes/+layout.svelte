<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { ModeWatcher, mode } from 'mode-watcher';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { invoke, isTauri } from '@tauri-apps/api/core';
	import { listen } from '@tauri-apps/api/event';
	import { error } from '@tauri-apps/plugin-log';
	import { forwardConsoleToLog } from '#lib/helpers/log/index.js';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '#lib/components/ui/toast/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { setState } from '#lib/state/index.svelte.js';
	import type { DialogState, UnsavedDecision } from '#lib/state/types.js';
	import { DIALOG_STATE_CTX } from '#lib/state/constants.js';
	import { setSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { setSelectNodesToDeleteState } from '#lib/hooks/select-nodes-to-delete.svelte.js';
	import { setCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';
	import { setProjectState } from '#lib/hooks/project-state.svelte.js';
	import { setOpenFileState } from '#lib/hooks/file-open.svelte.js';
	import { FILE_OPEN_EVENT, planFileOpenAction } from '#lib/helpers/file/open-request.js';
	import { WINDOW_CLOSE_REQUESTED } from '#lib/helpers/file/close-request.js';
	import { saveCurrentProject } from '#lib/helpers/file/index.js';
	import { createLeaveProject } from '#lib/hooks/leave-project.svelte.js';

	let { children } = $props();

	// INIT GLOBAL STATES
	const settings_state = setSettingsState(mode.current === 'light' ? 'light' : 'dark');
	const undo_redo_state = setUndoRedoState();
	setSelectNodesToDeleteState();
	setCollapsiblesState();
	const project_state = setProjectState();
	const dialogs_state = setState<DialogState>(
		{
			highestUnit: false,
			has_unsaved_changes: false,
			promptUnsavedChanges: () => promptUnsavedChanges()
		},
		DIALOG_STATE_CTX
	);
	const open_file_state = setOpenFileState();

	// OS file-open flow: the OS handed us a .heda path (double-click /
	// "Open With"). Requests are queued so prompts never interleave.
	const leave = createLeaveProject();
	const unsaved_resolvers = new SvelteSet<(decision: UnsavedDecision) => void>();
	let file_open_queue: Promise<void> = Promise.resolve();

	onMount(() => {
		// The log plugin only exists in the desktop app; on the web every call would reject.
		if (!isTauri()) return;
		const restore_console = forwardConsoleToLog();
		// Attach the listener before pulling the cold-start path Rust buffered
		// during setup, so no request can slip between the two.
		let disposed = false;
		let unlisten: (() => void) | undefined;
		let unlisten_close: (() => void) | undefined;
		listen<string>(FILE_OPEN_EVENT, (event) => requestFileOpen(event.payload))
			.then((fn) => {
				if (disposed) fn();
				else unlisten = fn;
			})
			.catch((err) => error(`Failed to listen for file open requests: ${err}`));
		// System close (Alt+F4 / close button) is prevented by Rust; it asks
		// us through this event whether the close may proceed after the
		// unsaved-changes flow.
		listen(WINDOW_CLOSE_REQUESTED, () => void leave.closeApp())
			.then((fn) => {
				if (disposed) fn();
				else unlisten_close = fn;
			})
			.catch((err) => error(`Failed to listen for window close requests: ${err}`));
		invoke<string | null>('take_pending_file_open')
			.then((path) => {
				if (path) requestFileOpen(path);
			})
			.catch((err) => error(`Failed to take pending file open: ${err}`));
		return () => {
			restore_console();
			disposed = true;
			unlisten?.();
			unlisten_close?.();
		};
	});

	// Several flows can prompt (file open, Home, window close); one decision
	// settles all of them so no caller is left hanging.
	function settleUnsavedChanges(decision: UnsavedDecision) {
		unsaved_resolvers.forEach((resolve_promise) => resolve_promise(decision));
		unsaved_resolvers.clear();
	}

	function promptUnsavedChanges(): Promise<UnsavedDecision> {
		return new Promise((resolve_promise) => {
			unsaved_resolvers.add(resolve_promise);
			dialogs_state.has_unsaved_changes = true;
		});
	}

	function requestFileOpen(path: string) {
		file_open_queue = file_open_queue
			.then(() => handleFileOpenRequest(path))
			.catch((err) => error(`Failed to handle file open request: ${err}`));
	}

	async function handleFileOpenRequest(path: string) {
		const plan = planFileOpenAction({
			project_loaded: project_state.loaded,
			has_unsaved_actions: undo_redo_state.has_unsaved_actions,
			auto_save_enabled: settings_state.auto_save_enabled
		});

		if (plan === 'confirm_save') {
			const decision = await promptUnsavedChanges();
			if (decision === 'cancel') return;
			if (
				decision === 'save' &&
				!(await saveCurrentProject(project_state.current_project_path, undo_redo_state))
			) {
				return;
			}
		} else if (
			plan === 'save_then_load' &&
			!(await saveCurrentProject(project_state.current_project_path, undo_redo_state))
		) {
			// A failed silent save must not discard the open project's changes.
			return;
		}

		await goto(resolve('/'));
		// Consumed by the home page after its session reset has run.
		open_file_state.pending_path = path;
	}
</script>

<svelte:document
	oncontextmenu={(e) => e.preventDefault()}
	onkeydown={(e) => {
		if (e.key === 'F5') {
			toast.info('F5 is disabled', {
				description: 'This is a system message, F5 is disabled in this application.'
			});
			e.preventDefault();
		}
	}}
/>

<Toaster position="top-right" />
<ModeWatcher />
{@render children?.()}

<AlertDialog.Root
	bind:open={dialogs_state.has_unsaved_changes}
	onOpenChange={(open) => {
		if (open) return;
		// Button clicks settle first (synchronously); a close without a
		// decision (ESC) resolves as cancellation on the next microtask.
		queueMicrotask(() => settleUnsavedChanges('cancel'));
	}}
>
	<AlertDialog.Content class="z-[100]">
		<AlertDialog.Header class="items-start text-left">
			<AlertDialog.Title class="text-lg font-semibold tracking-tight"
				>Unsaved changes found!</AlertDialog.Title
			>
			<AlertDialog.Description class="text-sm leading-relaxed">
				You have changes that are not saved yet. Save them before continuing?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
			<AlertDialog.Cancel
				class={buttonVariants({ variant: 'ghost' })}
				onclick={() => settleUnsavedChanges('cancel')}>Cancel</AlertDialog.Cancel
			>
			<AlertDialog.Action
				class={buttonVariants({ variant: 'destructive_soft' })}
				onclick={() => settleUnsavedChanges('continue')}>Don't save</AlertDialog.Action
			>
			<AlertDialog.Action class={buttonVariants()} onclick={() => settleUnsavedChanges('save')}
				>Save changes</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
