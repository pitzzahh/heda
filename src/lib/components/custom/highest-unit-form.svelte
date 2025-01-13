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
	import type { Project, Node } from '@/db/schema';
	import { getAllChildNodes } from '@/db/queries';
	import { generateKey, keyToString, writeEncryptedFile } from '@/helpers/security';
	import {
		generateUniqueFileName,
		getFileName,
		EXTENSION,
		doesFileExists,
		BASE_DIR
	} from '@/helpers/file';
	import { validateEnv } from '@/utils/validation';
	import { getProjectState } from '@/hooks/project-state.svelte';
	import { open as openFile } from '@tauri-apps/plugin-fs';
	import { save as saveDialog } from '@tauri-apps/plugin-dialog';

	interface Props {
		highest_unit_form: T;
		app_pass_phrase: string | null;
		file_encryption_salt: string | null;
		closeDialog: () => void;
	}

	let { highest_unit_form, app_pass_phrase, file_encryption_salt, closeDialog }: Props = $props();

	const project_state = getProjectState();

	const form = superForm(highest_unit_form, {
		SPA: true,
		validators: zodClient(highest_unit_schema),
		onUpdate: async ({ form }) => {
			// toast the values
			if (form.valid) {
				try {
					if (!validateEnv(app_pass_phrase, file_encryption_salt)) return;

					const file_path = await saveDialog({
						filters: [
							{
								name: 'Heda file',
								extensions: [EXTENSION]
							}
						]
					});

					if (!file_path) {
						return toast.warning('No folder selected', {
							description: 'Cannot proceed, no folder is selected.'
						});
					}

					const project_name = await getFileName(file_path);

					console.log(`Project name: ${project_name}`);

					const created_proj = (await createProject(project_name ?? 'Untitled', form.data)) as {
						project: Project;
						root_node_id: string;
					};

					if (!project_name) {
						toast.warning('Project title not fetched from file name.', {
							description: 'The project title is changed to untitled to avoid conflicts.'
						});
						await updateProjectTitle(created_proj.project.id, 'Untitled');
					}

					await project_state.setCurrentFile(
						await openFile(`${project_name}.${EXTENSION}`, {
							read: true,
							write: true,
							createNew: true,
							baseDir: BASE_DIR
						})
					);
					await writeEncryptedFile(
						{
							project: created_proj.project,
							nodes: await getAllChildNodes(created_proj.root_node_id, true)
						},
						keyToString(generateKey(app_pass_phrase!, file_encryption_salt!)),
						project_state
					);
					closeDialog();

					console.log(`File: ${file_path}`);
					project_state.addRecentProject({
						project_name,
						project_path: file_path,
						exists: true
					});
					await invalidate('app:workspace')
						.then(() =>
							goto(
								`/workspace/load-schedule/${form.data.distribution_unit}_${created_proj.root_node_id}`
							)
						)
						.finally(() =>
							toast.success(`${project_state.current_project_name} created successfully`)
						);
				} catch (err) {
					return toast.error(
						`Failed to create project: ${(err as any)?.message ?? 'something went wrong'}`,
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
