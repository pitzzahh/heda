<script lang="ts" module>
	interface Props {
		close_settings: () => void;
	}
</script>

<script lang="ts">
	import { CheckSquareIcon, FileIcon, HouseIcon, WarningCircleIcon } from '#lib/assets/icons.js';
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
	import { setServiceEntrance, setSmallDwelling } from '#lib/db/mutations/index.js';
	import { getRootNode } from '#lib/db/queries/index.js';
	import { createLeaveProject } from '#lib/hooks/leave-project.svelte.js';
	import { toast } from 'svelte-sonner';
	import { isAndroidApp } from '#lib/helpers/platform.js';
	import StandbyGeneratorSection from './standby-generator-section.svelte';
	import SolarPvSection from './solar-pv-section.svelte';

	let { close_settings }: Props = $props();

	const settingsState = getSettingsState();
	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();
	let dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const leave = createLeaveProject();
	const root_node = $derived(project_state.loaded ? getRootNode() : undefined);
	// Absent means the utility service supplies the project (PEC 2017 2.30.6.10).
	const is_service = $derived(root_node?.highest_unit_form?.is_service !== false);
	const small_dwelling = $derived(root_node?.highest_unit_form?.small_dwelling === true);

	async function saveServiceEntrance(value: boolean) {
		if (!root_node) return;
		const updated = await setServiceEntrance(root_node.id, value);
		if (!updated) return toast.warning('Failed to save the service entrance');
		toast.success(value ? 'Service entrance minimums applied' : 'Supplied as a feeder');
	}

	async function saveSmallDwelling(value: boolean) {
		if (!root_node) return;
		const updated = await setSmallDwelling(root_node.id, value);
		if (!updated) return toast.warning('Failed to save the dwelling setting');
		toast.success(value ? 'Marked as a dwelling of at most 50 m²' : 'No longer a small dwelling');
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

	// Android names new projects itself and never replaces a file, so there is nothing to back up.
	const show_backup = !isAndroidApp();
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
			<Label for="service_entrance">Utility Service Entrance</Label>
			<p class="text-xs text-muted-foreground">
				{is_service
					? 'The first panel holds the service disconnecting means: at least 60 A, 30 A for up to two 2-wire circuits, 15 A for one circuit (PEC 2017 2.30.6.10).'
					: 'The supply is a feeder from another service, so no service minimum applies.'}
			</p>
		</div>
		<Switch
			disabled={!root_node}
			id="service_entrance"
			checked={is_service}
			onCheckedChange={saveServiceEntrance}
		/>
	</div>
	<div class="flex flex-row items-center justify-between gap-3">
		<div class="space-y-0.5">
			<Label for="small_dwelling">Dwelling of at Most 50 m²</Label>
			<p class="text-xs text-muted-foreground">
				On one circuit (PEC 2017 2.10.1.11(C)(5)) it takes a 20 A service disconnect, not 15 A
				(2.30.6.10(B)); up to 3680 VA its plans may use A3 sheets (1.3.1.1(C)).
			</p>
		</div>
		<Switch
			disabled={!root_node}
			id="small_dwelling"
			checked={small_dwelling}
			onCheckedChange={saveSmallDwelling}
		/>
	</div>

	{#if root_node}
		<Separator class="my-1 w-full" />
		<StandbyGeneratorSection root={root_node} />
		<Separator class="my-1 w-full" />
		<SolarPvSection root={root_node} />
	{/if}

	<Separator class="my-1 w-full" />
	<div class="flex flex-row items-center justify-between gap-3">
		<div class="space-y-0.5">
			<Label for="auto_save">Auto Save</Label>
			<p class="text-xs text-muted-foreground">Automatically save the changes in your project</p>
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
	{#if show_backup}
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
						Old project file will be backed up when creating new project and replacing it upon
						project creation.
					{:else}
						Old project file will not be backed up when creating new project and replacing it upon
						project creation.
					{/if}
				</Alert.Description>
			</Alert.Root>
			<div class="flex flex-row items-center justify-between gap-3">
				<div class="space-y-0.5">
					<Label for="backup_project_file">Backup old project file</Label>
					<p class="text-xs text-muted-foreground">
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
	{/if}
</div>
