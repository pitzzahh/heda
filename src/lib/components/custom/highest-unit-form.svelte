<script lang="ts" generics="T extends SuperValidated<NonNullable<Node['highest_unit_form']>>">
	import { goto, invalidate } from '$app/navigation';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import * as RadioGroup from '@/components/ui/radio-group/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import { cn } from '@/utils';
	import { buttonVariants } from '@/components/ui/button';
	import { highest_unit_schema } from '@/schema';
	import { DEFAULT_PHASES_OPTIONS } from '@/constants';
	import { createProject, updateProjectTitle } from '@/db/mutations/index';
	import type { Node } from '@/db/schema';
	import { getAllChildNodes } from '@/db/queries';
	import { generateKey, keyToString } from '@/helpers/security';
	import { getFileName, writeEncryptedFile, EXTENSION, doesFileExists } from '@/helpers/file';
	import { validateEnv } from '@/utils/validation';
	import { getProjectState } from '@/hooks/project-state.svelte';
	import { getSettingsState } from '@/hooks/settings-state.svelte';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { remove, copyFile } from '@tauri-apps/plugin-fs';
	import { save as saveDialog } from '@tauri-apps/plugin-dialog';
	import type { FileExport } from '@/types/main';

	interface Props {
		highest_unit_form: T;
		app_pass_phrase: string | null;
		file_encryption_salt: string | null;
		closeDialog: () => void;
	}

	let { highest_unit_form, app_pass_phrase, file_encryption_salt, closeDialog }: Props = $props();

	const project_state = getProjectState();
	const settings_state = getSettingsState();
	const undo_redo_state = getUndoRedoState();

	const form = superForm(highest_unit_form, {
		SPA: true,
		validators: zodClient(highest_unit_schema),
		onUpdate: async ({ form }) => {
			// toast the values
			if (form.valid) {
				try {
					if (!validateEnv(app_pass_phrase, file_encryption_salt)) return;

					const file_path_with_file = await saveDialog({
						filters: [
							{
								name: 'Heda file',
								extensions: [EXTENSION]
							}
						]
					});

					if (!file_path_with_file) {
						return toast.warning('No folder selected', {
							description: 'Cannot proceed, no folder is selected.'
						});
					}

					const project_name = (await getFileName(file_path_with_file)) ?? 'Untitled';

					const created_project = await createProject(project_name, form.data, project_name);

					console.log(`Created project: ${JSON.stringify(created_project)}`);

					if (!created_project) {
						return toast.warning('Failed to create project', {
							description: 'The project was not created, please try again.'
						});
					}

					const { project, root_node_id } = created_project;

					if (!project_name) {
						await updateProjectTitle(project.id, 'Untitled');
						toast.warning('Project title not fetched from file name.', {
							description: 'The project title is changed to untitled to avoid conflicts.'
						});
					}

					if (await doesFileExists(file_path_with_file)) {
						if (settings_state.backup_project_file_if_exists) {
							console.info(`Current project exists, backing up first: ${file_path_with_file}`);
							toast.loading('Backing up project file', {
								description:
									'The project file is being backed up. You enabled this feature, to disable it go to settings.'
							});
							await copyFile(
								file_path_with_file,
								file_path_with_file.replace(EXTENSION, 'heda.bak')
							);
							toast.info('Project file backed up', {
								description:
									'The old project file has been backed up, you can find it in the same folder.'
							});
							project_state.removeRecentProject(project.id, true);
						}
						console.info(`Current project exists, removing first: ${file_path_with_file}`);
						await remove(file_path_with_file);
					}

					const file_data: FileExport = {
						project,
						nodes: await getAllChildNodes(project.root_node_id, true)
					};

					await writeEncryptedFile(
						file_data,
						keyToString(generateKey(app_pass_phrase!, file_encryption_salt!)),
						file_path_with_file
					);
					closeDialog();

					await invalidate('app:workspace')
						.then(() =>
							project_state.addRecentProject(
								{
									id: project.id,
									project_name,
									project_path: file_path_with_file,
									exists: true
								},
								true
							)
						)
						.then(() => {
							undo_redo_state.resetUnsavedActions();
						})
						.then(() =>
							goto(`/workspace/load-schedule/${form.data.distribution_unit}_${root_node_id}`)
						)
						.finally(() =>
							toast.success(`${project_state.current_project_name} created successfully`)
						)
						.catch((err) =>
							toast.error(
								`Error: failed to create project ${(err as any)?.message ?? 'something went wrong'}`,
								{
									description:
										'This is a system error and should not be here, the error has been logged.'
								}
							)
						);
				} catch (err) {
					console.error(`Error: failed to create project: ${JSON.stringify(err, null, 2)}`);
					return toast.error(
						`Error: failed to create project ${(err as any)?.message ?? 'something went wrong'}`,
						{
							description:
								'This is a system error and should not be here, the error has been logged.'
						}
					);
				}
			} else {
				toast.error('Form is invalid');
			}
		}
	});
	const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance>
	<div class="grid gap-2">
		<Form.Field {form} name="distribution_unit">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Distribution unit</Form.Label>
					<Input
						{...props}
						value={$formData.distribution_unit}
						defaultvalue="Transformer"
						placeholder="Enter the distribution unit name"
						readonly
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Fieldset {form} name="phase" class="space-y-3">
			<Form.Legend>Select a phase</Form.Legend>
			<RadioGroup.Root bind:value={$formData.phase} class="flex flex-col space-y-1" name="phase">
				{#each DEFAULT_PHASES_OPTIONS as phase_option}
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label
								class={cn(
									buttonVariants({
										variant: 'outline',
										className:
											'w-full font-normal hover:bg-primary/20 hover:text-white [&:has([data-state=checked])]:bg-primary/20'
									}),
									{
										'cursor-not-allowed': phase_option !== '1P'
									}
								)}
							>
								<!-- Currently disable other phases except 1P -->
								<RadioGroup.Item
									value={phase_option}
									disabled={phase_option !== '1P'}
									{...props}
									class="sr-only"
								/>
								{phase_option}
							</Form.Label>
						{/snippet}
					</Form.Control>
				{/each}
			</RadioGroup.Root>
			<Form.FieldErrors />
		</Form.Fieldset>
	</div>
	<Form.Button class="w-full">Proceed</Form.Button>
</form>
