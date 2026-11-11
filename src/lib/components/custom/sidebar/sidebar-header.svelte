<script lang="ts" module>
	import {
		CheckIcon,
		CircleNotchIcon,
		ExportIcon,
		HouseIcon,
		LockKeyIcon,
		FloppyDiskIcon,
		TableIcon
	} from '#lib/assets/icons/index.js';
	import type { Node } from '#lib/types/db/index.js';

	interface Props {
		root_node: Node;
	}
</script>

<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Settings } from '../index.js';
	import { toast } from 'svelte-sonner';
	import { UndoRedoButtons } from './(components)/index.js';
	import { exportToExcel } from '#lib/helpers/export/index.js';
	import type { ButtonState } from '#lib/types/misc/index.js';
	import {
		allowProjectFolder,
		saveCurrentProject,
		writeEncryptedFile,
		EXTENSION
	} from '#lib/helpers/file/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { createLeaveProject } from '#lib/hooks/leave-project.svelte.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Portal } from 'bits-ui';
	import { cn } from '#lib/utils/index.js';
	import PasswordDialog from '../password-dialog.svelte';
	import { getAllChildNodes, getCurrentProject } from '#lib/db/queries/index.js';
	import { save as saveDialog } from '@tauri-apps/plugin-dialog';
	import { untrack } from 'svelte';
	let { root_node }: Props = $props();

	let component_state = $state({
		export_to_excel: 'idle' as ButtonState,
		can_save: true,
		saving: false
	});

	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();
	let last_autosaved_version = -1;
	const project_state = getProjectState();
	const leave = createLeaveProject();

	async function handleSave() {
		if (component_state.saving) return;
		component_state.saving = true;
		try {
			if (!project_state.loaded) {
				console.error('Failed to save, project not yet loaded');
				return toast.warning('Failed to save, project not yet loaded', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}

			const saved = await saveCurrentProject(project_state.current_project_path, undo_redo_state);
			if (saved && !settings_state.auto_save_enabled) {
				toast.success('Saved successfully');
			}
		} finally {
			component_state.saving = false;
		}
	}

	let share_open = $state(false);
	let share_error = $state<string | null>(null);
	let share_busy = $state(false);

	// A password-protected copy that anyone with the password can open. The
	// current file keeps its own protection.
	async function handleShareSubmit(password: string) {
		share_busy = true;
		share_error = null;
		try {
			const current = getCurrentProject();
			if (!current) throw new Error('No project found');
			const path = await saveDialog({
				filters: [{ name: 'Heda file', extensions: [EXTENSION] }]
			});
			if (!path) return;
			const file_path = path.endsWith(`.${EXTENSION}`) ? path : `${path}.${EXTENSION}`;
			// The dialog granted only the picked path, which may lack the extension.
			await allowProjectFolder(file_path);
			await writeEncryptedFile(
				{ project: current, nodes: getAllChildNodes(current.root_node_id, true) },
				password,
				file_path,
				true
			);
			share_open = false;
			toast.success('Password-protected copy saved', {
				description: 'Anyone with the password can open this file.'
			});
		} catch (err) {
			share_error = (err as Error)?.message ?? 'The copy could not be saved.';
		} finally {
			share_busy = false;
		}
	}

	// Auto-saver: writes each edit version once. Reading `saving` re-runs it after an
	// in-flight save, so edits made during that write are saved next; a failed save
	// is not retried until the next edit.
	$effect(() => {
		const version = undo_redo_state.edit_version;
		if (
			!undo_redo_state.has_unsaved_actions ||
			!settings_state.auto_save_enabled ||
			component_state.saving ||
			version === last_autosaved_version
		) {
			return;
		}
		last_autosaved_version = version;
		untrack(handleSave);
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.ctrlKey && e.key.toLocaleLowerCase() === 's' && !settings_state.auto_save_enabled) {
			handleSave();
		}
	}}
/>

<div
	class="flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-2"
>
	<div
		class="flex items-center gap-0.5 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 p-0.5"
	>
		{#if !settings_state.auto_save_enabled}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger
						disabled={!project_state.loaded ||
							!component_state.can_save ||
							!undo_redo_state.has_unsaved_actions ||
							component_state.saving}
						class={buttonVariants({
							variant: undo_redo_state.has_unsaved_actions ? 'default' : 'ghost',
							size: 'sm'
						})}
						onclick={() => handleSave()}
					>
						<CircleNotchIcon
							class={cn('hidden size-4 animate-spin', { block: component_state.saving })}
						/>
						{#if undo_redo_state.has_unsaved_actions}
							<FloppyDiskIcon class={cn('size-4', { hidden: component_state.saving })} />
							Save
						{:else}
							<CheckIcon class={cn('size-4', { hidden: component_state.saving })} />
							Saved
						{/if}
					</Tooltip.Trigger>
					<Tooltip.Content>
						{undo_redo_state.has_unsaved_actions ? 'Save changes (Ctrl+S)' : 'All changes saved'}
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}

		<Settings />
		<UndoRedoButtons />
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
					onclick={() => void leave.goHome()}
					aria-label="Go Home"
				>
					<HouseIcon class="size-4" />
				</Tooltip.Trigger>
				<Tooltip.Content
					>{undo_redo_state.has_unsaved_actions
						? 'Go Home (unsaved changes will prompt)'
						: 'Go Home'}</Tooltip.Content
				>
			</Tooltip.Root>
		</Tooltip.Provider>
	</div>
	<svelte:boundary>
		<DropdownMenu.Root>
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger disabled={!project_state.loaded}>
						{#snippet child({ props })}
							<DropdownMenu.Trigger
								{...props}
								disabled={!project_state.loaded}
								class={buttonVariants({
									variant: 'outline',
									size: 'icon-sm'
								})}
								aria-label="Export options"
							>
								<ExportIcon class="size-4" />
							</DropdownMenu.Trigger>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Export</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<Portal>
				<DropdownMenu.Content class="z-50 flex w-fit flex-col gap-2">
					<DropdownMenu.Group>
						<DropdownMenu.Label class="text-center">Export options</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							disabled={component_state.export_to_excel === 'loading'}
							onclick={async () => {
								exportToExcel(
									'LOAD_SCHEDULE',
									root_node.id,
									root_node?.highest_unit_form,
									project_state.current_project_name,
									() => (component_state.export_to_excel = 'idle'),
									() => (component_state.export_to_excel = 'loading')
								);
							}}
						>
							<CircleNotchIcon
								class={cn('mr-0.5 hidden h-4 w-4 animate-spin', {
									block: component_state.export_to_excel === 'loading'
								})}
							/>
							<TableIcon
								class={cn('mr-0.5 block h-4 w-4', {
									'opacity-50': component_state.export_to_excel === 'loading'
								})}
							/>
							Export whole project load schedule</DropdownMenu.Item
						>
						<DropdownMenu.Item
							disabled={component_state.export_to_excel === 'loading'}
							onclick={async () => {
								exportToExcel(
									'VOLTAGE_DROP',
									root_node.id,
									root_node?.highest_unit_form,
									project_state.current_project_name,
									() => (component_state.export_to_excel = 'idle'),
									() => (component_state.export_to_excel = 'loading')
								);
							}}
						>
							<CircleNotchIcon
								class={cn('mr-0.5 hidden h-4 w-4 animate-spin', {
									block: component_state.export_to_excel === 'loading'
								})}
							/>
							<TableIcon
								class={cn('mr-0.5 block h-4 w-4', {
									'opacity-50': component_state.export_to_excel === 'loading'
								})}
							/>
							Export whole project voltage drop</DropdownMenu.Item
						>
						<DropdownMenu.Item onclick={() => (share_open = true)}>
							<LockKeyIcon class="mr-0.5 block h-4 w-4" />
							Export password-protected copy</DropdownMenu.Item
						>
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</Portal>
		</DropdownMenu.Root>
		{#snippet failed(error, reset)}
			<div class="grid w-full gap-2 rounded-xl border border-dashed p-3">
				<p class="text-xs text-muted-foreground">{error}</p>
				<Button onclick={reset} size="sm" variant="outline">Try again</Button>
			</div>
		{/snippet}
	</svelte:boundary>
</div>

<PasswordDialog
	bind:open={share_open}
	mode="create"
	error={share_error}
	busy={share_busy}
	onSubmit={handleShareSubmit}
/>
