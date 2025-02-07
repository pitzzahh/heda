<script lang="ts">
	import { tick } from 'svelte';
	import { AppSidebar } from '@/components/custom/sidebar';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Sidebar from '@/components/ui/sidebar/index.js';
	import { buttonVariants, Button } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { HighestUnitForm, PageProgress } from '@/components/custom';
	import { Input } from '@/components/ui/input';
	import { PenLine, Save } from '@/assets/icons';
	import { getState } from '@/state/index.svelte';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
	import { DIALOG_STATE_CTX } from '@/state/constants.js';
	import type { DialogState } from '@/state/types.js';
	import type { Node } from '@/db/schema';
	import { updateProjectTitle } from '@/db/mutations/index.js';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import UndoRedoWrapper from '@/components/custom/undo-redo-wrapper.svelte';
	import { rename, open as openFile, copyFile, remove } from '@tauri-apps/plugin-fs';
	import {
		doesFileExists,
		EXTENSION,
		getFileNameWithoutExtension,
		generateUniqueFileName
	} from '@/helpers/file/index.js';
	import { getProjectState } from '@/hooks/project-state.svelte.js';
	import { join } from '@tauri-apps/api/path';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte.js';
	import { getSettingsState } from '@/hooks/settings-state.svelte';

	let { data, children } = $props();

	const {
		is_new_file,
		is_load_file,
		generic_phase_panel_form,
		phase_main_load_form,
		project,
		app_pass_phrase,
		file_encryption_salt,
		can_create_project
	} = $derived(data);

	const dialogs_state = getState<DialogState>(DIALOG_STATE_CTX);
	const project_state = getProjectState();
	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();

	let component_state = $state({
		is_editing: false,
		project_title: data.project_title ?? 'Untitled'
	});

	function toggleEdit() {
		component_state.is_editing = !component_state.is_editing;
		tick().then(() => {
			document.getElementById('project-title-input')?.focus();
		});
	}

	async function saveProjectTitle() {
		if (!project) return;

		if (!component_state.project_title) {
			component_state.is_editing = false;
			return;
		}

		try {
			const current_project = project_state.geCurrentProject();

			if (!current_project) {
				console.error(`No project found: ${current_project}`);
				return toast.warning('No project found from project state', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}

			const project_name = data.project_title ?? 'Untitled';
			let new_project_name = component_state.project_title;

			const old_file = `${getFileNameWithoutExtension(project_name)}.${EXTENSION}`;
			const new_file = `${getFileNameWithoutExtension(new_project_name)}.${EXTENSION}`;

			const current_file_path = current_project.project_path.replace(old_file, '');

			const old_file_path = await join(current_file_path, old_file);
			const new_file_path_with_file = `${await join(current_file_path.replace(`${old_file}.${EXTENSION}`, ''), new_file)}`;

			console.log(`old_file: ${old_file}`);
			console.log(`new_file: ${new_file}`);
			console.log(`project_name: ${project_name}`);
			console.log(`new_project_name: ${new_project_name}`);
			console.log(`current_file_path: ${current_file_path}`);
			console.log(`old_file_path: ${old_file_path}`);
			console.log(`new_file_path: ${new_file_path_with_file}`);

			if (project_name !== new_project_name && (await doesFileExists(new_file_path_with_file))) {
				new_project_name = await generateUniqueFileName(new_project_name);
				toast.info('Project title already exists, we will rename it for you.', {
					description: 'The project title is appended with a number to avoid conflicts.'
				});
				if (settings_state.backup_project_file_if_exists) {
					console.info(`Current project exists, backing up first: ${new_file_path_with_file}`);
					toast.loading('Backing up project file', {
						description:
							'The project file is being backed up. You enabled this feature, to disable it go to settings.'
					});
					await copyFile(
						new_file_path_with_file,
						new_file_path_with_file.replace(EXTENSION, 'heda.bak')
					);
					toast.info('Project file backed up', {
						description:
							'The old project file has been backed up, you can find it in the same folder.'
					});
					project_state.removeRecentProject(project.id, true);
				}
				console.info(`Current project exists, removing first: ${new_file_path_with_file}`);
			}
			component_state.project_title = getFileNameWithoutExtension(new_project_name);
			await rename(old_file_path, new_file_path_with_file);
			project_state.current_project_name = new_project_name;
			await updateProjectTitle(project.id, new_project_name)
				.then(() => invalidate('app:workspace'))
				.then(() =>
					project_state.updateProject(
						project.id,
						{
							project_name: new_project_name,
							project_path: new_file_path_with_file
						},
						true
					)
				)
				.then(() => undo_redo_state.setHasUnsavedActions())
				.then(() => toggleEdit())
				.then(() => toast.success('Project title updated successfully'))
				.catch((err) =>
					toast.error(
						`Failed to update project title: ${(err as any)?.message ?? 'something went wrong'}`,
						{
							description:
								'This is a system error and should not be here, the error has been logged.'
						}
					)
				);
		} catch (err) {
			console.error(`Failed to update project title: ${JSON.stringify(err)}`);
			return toast.error(
				`Failed to update project title: ${(err as any)?.message ?? 'something went wrong'}`,
				{
					description: 'This is a system error and should not be here, the error has been logged.'
				}
			);
		}
	}
	$effect(() => {
		component_state.project_title = data.project_title ?? 'Untitled';
	});
	$effect(() => {
		if (is_load_file) {
			component_state.project_title = data.project_title ?? 'Untitled';
			toast.loading('Loading project data', {
				description: 'Please wait while we load your project data.'
			});
		}
		dialogs_state.highestUnit = is_new_file;
	});
</script>

<PageProgress />
<UndoRedoWrapper>
	<Sidebar.Provider>
		<AppSidebar
			project={data.project}
			root_node={data.root_node as Node}
			{generic_phase_panel_form}
			{phase_main_load_form}
			{can_create_project}
			{app_pass_phrase}
			{file_encryption_salt}
		/>
		<Sidebar.Inset>
			<header
			class="fixed z-10 flex h-16 w-full shrink-0 items-center gap-2 border-b bg-background px-4"
		>
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 h-4" />
			<p>
				{project_state.current_project_name ?? 'Untitled'}
			</p>
		</header>

			<svelte:boundary>
				<div class="mt-16 flex w-full items-center justify-center gap-4 p-4">
					{@render children?.()}
				</div>
				{#snippet failed(error, reset)}
					<p class="text-sm text-muted-foreground">{error}</p>
					<Button onclick={reset}>oops! try again</Button>
				{/snippet}
			</svelte:boundary>
		</Sidebar.Inset>
	</Sidebar.Provider>

	<Dialog.Root bind:open={dialogs_state.highestUnit}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title class="text-center font-bold"
					>Choose the highest unit for this project.</Dialog.Title
				>
			</Dialog.Header>
			<HighestUnitForm
				highest_unit_form={data.highest_unit_form}
				{app_pass_phrase}
				{file_encryption_salt}
				closeDialog={() => (dialogs_state.highestUnit = false)}
			/>
		</Dialog.Content>
	</Dialog.Root>
</UndoRedoWrapper>

<AlertDialog.Root bind:open={dialogs_state.has_unsaved_changes}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Unsaved changes found!</AlertDialog.Title>
			<AlertDialog.Description>
				Would you like to save your current changes before performing any actions?
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel class={buttonVariants({ variant: 'ghost' })}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action class={buttonVariants({ variant: 'destructive' })}
				>Continue without saving changes</AlertDialog.Action
			>
			<AlertDialog.Action class={buttonVariants()}>Save and continue</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
