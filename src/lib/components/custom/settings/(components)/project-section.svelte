<script lang="ts" module>
	interface Props {
		close_settings: () => void;
	}
</script>

<script lang="ts">
	import {
		CheckSquareIcon,
		FileIcon,
		HouseIcon,
		WarningCircleIcon
	} from '#lib/assets/icons/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { getState } from '#lib/state/index.svelte.js';
	import { DIALOG_STATE_CTX } from '#lib/state/constants.js';
	import type { DialogState } from '#lib/state/types.js';
	import { updateProjectSettings } from '#lib/db/mutations/index.js';
	import { createLeaveProject } from '#lib/hooks/leave-project.svelte.js';
	import { toast } from 'svelte-sonner';

	let { close_settings }: Props = $props();

	const settingsState = getSettingsState();
	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();
	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const leave = createLeaveProject();

	async function savePreference(message: string) {
		if (!project_state.loaded) return;

		const updated = updateProjectSettings(project_state.id, {
			is_adjustment_factor_dynamic: settingsState.is_adjustment_factor_dynamic
		});

		if (!updated) return toast.warning('Failed to save the preference');

		undo_redo_state.setHasUnsavedActions();
		toast.success(message);
	}

	function handleHomeClick(event: MouseEvent) {
		if (!undo_redo_state.has_unsaved_actions) {
			leave.resetSession();
			return; // the anchor navigates natively
		}

		// Defer the anchor until the save finishes or the dialog is answered.
		event.preventDefault();
		// Settings closes first so the prompt stacks on a clean backdrop.
		void leave.goHome(() => close_settings());
	}

	async function handleNewProject() {
		if (!(await leave.confirmLeave(() => close_settings()))) return;
		close_settings();
		leave.resetSession();
		dialogs_state.highestUnit = true;
	}
</script>

<div class="flex flex-col gap-2">
	<p class="text-sm font-semibold tracking-tight">Project</p>
	<div class="grid w-full grid-cols-2 gap-1.5">
		<Button onclick={handleHomeClick} href="/" class="w-full" variant="outline">
			<HouseIcon />
			Home
		</Button>
		<Button onclick={handleNewProject} class="w-full">
			<FileIcon />
			New Project
		</Button>
	</div>

	<Separator class="my-1 w-full" />
	<div class="flex flex-row items-center justify-between gap-3">
		<div class="space-y-0.5">
			<Label for="adjustment_factor">Adjustment Factor</Label>
			<p class="text-muted-foreground text-xs">
				{settingsState.is_adjustment_factor_dynamic
					? 'The adjustment factor for each load may vary between 100%, 80%, 70%, 50%, 45%, 40%, and 35%, depending on the total number of conductors.'
					: 'The adjustment factor for all loads will be set to 100%.'}
			</p>
		</div>
		<Switch
			disabled={!project_state.loaded}
			id="adjustment_factor"
			bind:checked={settingsState.is_adjustment_factor_dynamic}
			onCheckedChange={async () => await savePreference('Adjustment factor applied successfully')}
		/>
	</div>

	<Separator class="my-1 w-full" />
	<div class="flex flex-row items-center justify-between gap-3">
		<div class="space-y-0.5">
			<Label for="auto_save">Auto Save</Label>
			<p class="text-muted-foreground text-xs">Automatically save the changes in your project</p>
		</div>
		<Switch
			disabled={!project_state.loaded}
			id="auto_save"
			checked={settingsState.auto_save_enabled}
			onCheckedChange={(value) => {
				settingsState.setAutoSave(value);
				toast.success(`Auto save ${value ? 'enabled' : 'disabled'} successfully`);
			}}
		/>
	</div>
	<Separator class="my-1 w-full" />
	<div class="flex flex-col gap-2">
		<Alert.Root variant={settingsState.backup_project_file_if_exists ? 'success' : 'warning'}>
			{#if settingsState.backup_project_file_if_exists}
				<CheckSquareIcon class="size-4" />
			{:else}
				<WarningCircleIcon class="size-4" />
			{/if}

			<Alert.Description>
				{#if settingsState.backup_project_file_if_exists}
					Old project file will be backed up when creating new project and replacing it upon project
					creation.
				{:else}
					Old project file will not be backed up when creating new project and replacing it upon
					project creation.
				{/if}
			</Alert.Description>
		</Alert.Root>
		<div class="flex flex-row items-center justify-between gap-3">
			<div class="space-y-0.5">
				<Label for="backup_project_file">Backup old project file</Label>
				<p class="text-muted-foreground text-xs">
					Automatically backup old project file when creating new project and performing replacing
					it upon project creation.
				</p>
			</div>
			<Switch
				id="backup_project_file"
				checked={settingsState.backup_project_file_if_exists}
				onCheckedChange={(value) => {
					settingsState.setBackupProjectFileIfExists(value);
					if (value) {
						toast.success(`Backup project file enabled successfully`, {
							description:
								'Old project file will be backed up when creating new project and replacing it upon project creation.'
						});
					} else {
						toast.warning(`Backup project file disabled successfully`, {
							description:
								'Old project file will not be backed up when creating new project and replacing it upon project creation.'
						});
					}
				}}
			/>
		</div>
	</div>
</div>
