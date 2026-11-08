<script lang="ts" module>
	interface Props {
		closeDialog: () => void;
	}
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createForm, Field, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '#lib/components/ui/input/index.js';
	import { PasswordInput } from '#lib/components/ui/password-input/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { cn } from '#lib/utils/index.js';
	import { HIGHEST_UNIT_SCHEMA } from '#lib/validators/index.js';
	import type { Phase } from '#lib/types/phase/index.js';
	import { DEFAULT_PHASES, default_phases } from '#lib/constants/index.js';
	import { createProject, updateProjectTitle } from '#lib/db/mutations/index.js';
	import { getAllChildNodes } from '#lib/db/queries/index.js';
	import { setSessionPassword } from '#lib/db/session.js';
	import {
		getFileName,
		writeEncryptedFile,
		EXTENSION,
		doesFileExists,
		generateUniqueFileName
	} from '#lib/helpers/file/index.js';
	import { LockKeyIcon } from '#lib/assets/icons/index.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { remove, copyFile } from '@tauri-apps/plugin-fs';
	import { save as saveDialog } from '@tauri-apps/plugin-dialog';
	import type { FileExport } from '#lib/types/main/index.js';

	let { closeDialog }: Props = $props();

	const project_state = getProjectState();
	const settings_state = getSettingsState();
	const undo_redo_state = getUndoRedoState();

	const form = createForm({
		schema: HIGHEST_UNIT_SCHEMA,
		initialInput: { distribution_unit: 'Transformer' }
	});

	let submitting = $state(false);

	async function handleSubmit() {
		if (submitting) return;
		const result = await validate(form);
		if (!result.success) {
			toast.error('Form is invalid');
			return;
		}
		const data = result.output;
		submitting = true;
		try {
			// Passwords are never stored. They unlock the session and seal the file.
			const project_input = {
				distribution_unit: data.distribution_unit,
				phase: data.phase
			};
			setSessionPassword(data.password);

			let file_path_with_file = await saveDialog({
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

			// The dialog filter doesn't append it, and files without it won't match `*.heda` later.
			if (!file_path_with_file.endsWith(`.${EXTENSION}`)) {
				file_path_with_file += `.${EXTENSION}`;
			}

			let project_name = (await getFileName(file_path_with_file)) ?? 'Untitled';

			const created_project = await createProject(project_name, project_input);

			if (!created_project) {
				return toast.warning('Failed to create project', {
					description: 'The project was not created, please try again.'
				});
			}

			const { project, root_node_id } = created_project;

			if (!project_name) {
				project_name = await generateUniqueFileName('Untitled Project');
				updateProjectTitle(project.id, project_name);
				toast.warning('Project title not fetched from file name.', {
					description: 'The project title is changed to untitled to avoid conflicts.'
				});
			}

			if (await doesFileExists(file_path_with_file)) {
				if (settings_state.backup_project_file_if_exists) {
					const toast_id = toast.loading('Backing up project file', {
						description:
							'The project file is being backed up. You enabled this feature, to disable it go to settings.'
					});
					await copyFile(file_path_with_file, file_path_with_file.replace(EXTENSION, 'heda.bak'));
					toast.info('Project file backed up', {
						id: toast_id,
						description:
							'The old project file has been backed up, you can find it in the same folder.'
					});
					project_state.removeRecentProject(project.id, true);
				}
				await remove(file_path_with_file);
			}

			const file_data: FileExport = {
				project,
				nodes: getAllChildNodes(project.root_node_id, true)
			};

			await writeEncryptedFile(file_data, data.password, file_path_with_file, true);
			closeDialog();
			project_state.addRecentProject(
				{
					id: project.id,
					project_name,
					project_path: file_path_with_file,
					exists: true
				},
				true
			);
			// The schedule page bounces home while loaded is false; mark it before navigating.
			project_state.setProjectLoaded(true);
			await goto(
				resolve('/(workspaces)/workspace/load-schedule/[id]', {
					id: `${data.distribution_unit}_${root_node_id}`
				})
			)
				.then(() => {
					toast.success(`${project_state.current_project_name} created successfully`);
				})
				.catch((err) => {
					console.error(`Error: failed to create project: ${JSON.stringify(err, null, 2)}`);
					toast.error(
						`Error: failed to create project ${(err as Error)?.message ?? 'something went wrong'}`,
						{
							description:
								'This is a system error and should not be here, the error has been logged.'
						}
					);
				})
				.finally(() => undo_redo_state.setHasUnsavedActions());
		} catch (err) {
			console.error(`Error: failed to create project: ${JSON.stringify(err, null, 2)}`);
			return toast.error(
				`Error: failed to create project ${(err as Error)?.message ?? 'something went wrong'}`,
				{
					description: 'This is a system error and should not be here, the error has been logged.'
				}
			);
		} finally {
			submitting = false;
		}
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
>
	<div class="grid gap-4">
		<Field of={form} path={['distribution_unit']}>
			{#snippet children(field)}
				<div class="space-y-2">
					<Label class={cn(field.errors && 'text-destructive')}>Distribution unit</Label>
					<Input
						{...field.props}
						value={field.input ?? ''}
						placeholder="Enter the distribution unit name"
						readonly
						tabindex={-1}
					/>
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
		<Field of={form} path={['phase']}>
			{#snippet children(field)}
				<fieldset class="space-y-3">
					<legend
						class="text-muted-foreground text-[10px] leading-none font-semibold tracking-[0.2em] uppercase"
					>
						Phase System
					</legend>
					<RadioGroup.Root
						value={field.input ?? ''}
						onValueChange={(value) => field.onInput(value as Phase)}
						class="flex flex-col gap-2"
						name={field.props.name}
					>
						{#each DEFAULT_PHASES as phase_option (phase_option.value)}
							<Label
								class={cn(
									buttonVariants({
										variant: 'outline',
										className:
											'hover:border-primary/40 hover:bg-accent [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10 [&:has([data-state=checked])]:text-primary h-11 w-full justify-between px-4 font-medium'
									}),
									{
										'cursor-not-allowed opacity-60': phase_option.value !== default_phases.ONE_PHASE
									}
								)}
							>
								<!-- Currently only single-phase supply is supported -->
								<RadioGroup.Item
									value={phase_option.value}
									disabled={phase_option.value !== default_phases.ONE_PHASE}
									class="sr-only"
								/>
								<span>{phase_option.label}</span>
								{#if phase_option.value !== default_phases.ONE_PHASE}
									<span
										class="text-muted-foreground text-[9px] font-bold tracking-[0.2em] uppercase"
										>Soon</span
									>
								{:else}
									<span class="text-primary/70 text-[9px] font-bold tracking-[0.2em] uppercase"
										>Available</span
									>
								{/if}
							</Label>
						{/each}
					</RadioGroup.Root>
					<FieldErrors errors={field.errors} />
				</fieldset>
			{/snippet}
		</Field>
		<Field of={form} path={['password']}>
			{#snippet children(field)}
				<div class="space-y-2">
					<Label class={cn(field.errors && 'text-destructive')}>File password</Label>
					<PasswordInput
						{...field.props}
						label="File password"
						value={field.input ?? ''}
						onValueChange={(v) => field.onInput(v)}
						autocomplete="new-password"
						placeholder="Protects this file (min. 8 characters)"
					/>
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
		<Field of={form} path={['confirm_password']}>
			{#snippet children(field)}
				<div class="space-y-2">
					<Label class={cn(field.errors && 'text-destructive')}>Confirm password</Label>
					<PasswordInput
						{...field.props}
						label="Confirm file password"
						value={field.input ?? ''}
						onValueChange={(v) => field.onInput(v)}
						autocomplete="new-password"
						placeholder="Repeat the file password"
					/>
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
	</div>
	<Button type="submit" class="mt-5 h-11 w-full" loading={submitting}>
		<LockKeyIcon class="size-4" />
		Proceed
	</Button>
</form>
