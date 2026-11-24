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
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { cn } from '#lib/utils/index.js';
	import { HIGHEST_UNIT_SCHEMA } from '#lib/validators/index.js';
	import type { Phase } from '#lib/types/phase.js';
	import { DEFAULT_PHASES, PHASE_SYSTEM_VOLTAGES } from '#lib/constants.js';
	import { createProject } from '#lib/db/mutations/index.js';
	import { getAllChildNodes } from '#lib/db/queries/index.js';
	import { setSession } from '#lib/db/session.js';
	import { getDeviceKey } from '#lib/helpers/security/device-key.js';
	import { loadScheduleRouteId } from '#lib/helpers/navigation.js';
	import { showInFolderAction } from '#lib/helpers/file/reveal.js';
	import { newLibraryFile, UNTITLED_PROJECT_NAME } from '#lib/helpers/file/library.js';
	import { isAndroidApp } from '#lib/helpers/platform.js';
	import {
		getFileName,
		writeDeviceEncryptedFile,
		writeEncryptedFile,
		EXTENSION,
		doesFileExists,
		allowProjectFolder
	} from '#lib/helpers/file/index.js';
	import { LockKeyIcon } from '#lib/assets/icons.js';
	import { getProjectState } from '#lib/hooks/project-state.svelte.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { copyFile } from '@tauri-apps/plugin-fs';
	import { save as saveDialog } from '@tauri-apps/plugin-dialog';
	import type { FileExport } from '#lib/types/main.js';

	let { closeDialog }: Props = $props();

	const project_state = getProjectState();
	const settings_state = getSettingsState();
	const undo_redo_state = getUndoRedoState();

	const form = createForm({
		schema: HIGHEST_UNIT_SCHEMA,
		initialInput: { use_password: false, is_service: true, small_dwelling: false }
	});

	let submitting = $state(false);
	const form_id = $props.id();

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
			// Secrets are never stored. The password (when set) unlocks the
			// session and seals the file; otherwise the device key does both.
			const project_input = {
				distribution_unit: data.distribution_unit,
				phase: data.phase,
				is_service: data.is_service,
				small_dwelling: data.small_dwelling
			};
			const password = data.use_password ? data.password : undefined;
			const device_key = password ? null : await getDeviceKey();
			setSession(password ?? device_key!, password ? 'password' : 'device');

			// Android keeps projects in the app's own folder, named in this form.
			let file_path_with_file = android
				? await newLibraryFile(data.project_name || UNTITLED_PROJECT_NAME)
				: await saveDialog({
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

			if (!android) {
				// The dialog filter doesn't append it, and files without it won't match `*.heda` later.
				if (!file_path_with_file.endsWith(`.${EXTENSION}`)) {
					file_path_with_file += `.${EXTENSION}`;
				}
				// The dialog granted only the picked path; the backup and the appended
				// extension need the folder.
				await allowProjectFolder(file_path_with_file);
			}

			const project_name = (await getFileName(file_path_with_file)) || 'Untitled';

			const created_project = await createProject(project_name, project_input);

			if (!created_project) {
				return toast.warning('Failed to create project', {
					description: 'The project was not created, please try again.'
				});
			}

			const { project, root_node_id } = created_project;

			const replacing = await doesFileExists(file_path_with_file);
			if (replacing) {
				if (settings_state.backup_project_file_if_exists) {
					const toast_id = toast.loading('Backing up project file', {
						description:
							'The project file is being backed up. You enabled this feature, to disable it go to settings.'
					});
					await copyFile(file_path_with_file, `${file_path_with_file}.bak`);
					toast.info('Project file backed up', {
						id: toast_id,
						description:
							'The old project file has been backed up, you can find it in the same folder.'
					});
				}
			}
			// The new project takes over the path; an old entry for it would reopen it under a stale id.
			for (const old of project_state.recent_projects?.filter(
				(recent) => recent.project_path === file_path_with_file
			) ?? []) {
				project_state.removeRecentProject(old.id);
			}

			const file_data: FileExport = {
				project,
				nodes: getAllChildNodes(project.root_node_id, true)
			};

			if (password) {
				await writeEncryptedFile(file_data, password, file_path_with_file, !replacing);
			} else {
				await writeDeviceEncryptedFile(file_data, device_key!, file_path_with_file, !replacing);
			}
			closeDialog();
			project_state.addRecentProject(
				{
					id: project.id,
					project_name,
					project_path: file_path_with_file,
					exists: true,
					protection: password ? 'password' : 'device'
				},
				true
			);
			// The schedule page bounces home while loaded is false; mark it before navigating.
			project_state.setProjectLoaded(true);
			await goto(
				resolve('/(workspaces)/workspace/load-schedule/[id]', {
					id: loadScheduleRouteId(data.distribution_unit, root_node_id)
				})
			)
				.then(() => {
					toast.success(`${project_state.current_project_name} created successfully`, {
						action: showInFolderAction(file_path_with_file)
					});
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

	const android = isAndroidApp();
</script>

<form
	id={form_id}
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
>
	<div class="grid gap-4">
		{#if android}
			<Field of={form} path={['project_name']}>
				{#snippet children(field)}
					<div class="space-y-2">
						<Label class={cn(field.errors && 'text-destructive')}>Project name</Label>
						<Input
							{...field.props}
							value={field.input ?? ''}
							placeholder={UNTITLED_PROJECT_NAME}
							autocomplete="off"
						/>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		{/if}
		<Field of={form} path={['distribution_unit']}>
			{#snippet children(field)}
				<div class="space-y-2">
					<Label class={cn(field.errors && 'text-destructive')}>Distribution unit</Label>
					<Input {...field.props} value={field.input ?? ''} placeholder="Transformer" />
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
		<Field of={form} path={['phase']}>
			{#snippet children(field)}
				<fieldset class="space-y-2">
					<legend
						class={cn('text-sm leading-none font-medium', field.errors && 'text-destructive')}
					>
						Phase system
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
											'h-11 w-full justify-between px-4 font-medium hover:border-primary/40 hover:bg-accent has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/10 has-data-[state=checked]:text-primary'
									})
								)}
							>
								<RadioGroup.Item value={phase_option.value} class="sr-only" />
								<span>{phase_option.label}</span>
								<span class="text-[9px] font-bold tracking-[0.2em] text-primary/70 uppercase"
									>{PHASE_SYSTEM_VOLTAGES[phase_option.value]}</span
								>
							</Label>
						{/each}
					</RadioGroup.Root>
					<FieldErrors errors={field.errors} />
				</fieldset>
			{/snippet}
		</Field>
		<Field of={form} path={['is_service']}>
			{#snippet children(field)}
				<div class="rounded-xl border p-3">
					<Checkbox
						checked={field.input ?? true}
						onCheckedChange={(v) => field.onInput(v)}
						label="Utility service entrance"
						description="On: the first panel holds the service disconnecting means, at least 60 A (30 A for up to two 2-wire circuits, 15 A for one), PEC 2017 2.30.6.10. Turn off when this supply is a feeder from another building's service."
					/>
				</div>
			{/snippet}
		</Field>
		<Field of={form} path={['small_dwelling']}>
			{#snippet children(field)}
				<div class="rounded-xl border p-3">
					<Checkbox
						checked={field.input ?? false}
						onCheckedChange={(v) => field.onInput(v)}
						label="Dwelling of at most 50 m²"
						description="On one circuit it takes a 20 A service disconnect (PEC 2017 2.30.6.10(B)), and up to 3680 VA its plans may use A3 sheets (1.3.1.1(C))."
					/>
				</div>
			{/snippet}
		</Field>
		<Field of={form} path={['use_password']}>
			{#snippet children(use_password_field)}
				<div class="rounded-xl border p-3">
					<Checkbox
						checked={use_password_field.input ?? false}
						onCheckedChange={(v) => use_password_field.onInput(v)}
						label="Protect with a password"
						description="Off: this device's key encrypts the file, so it opens with no password. Use a password only if this file must be shared with another device."
					/>
					{#if use_password_field.input}
						<div class="grid gap-4 pt-3">
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
					{/if}
				</div>
			{/snippet}
		</Field>
	</div>
</form>

<Dialog.Footer>
	<Button type="button" variant="ghost" onclick={closeDialog}>Cancel</Button>
	<Button type="submit" form={form_id} loading={submitting}>
		<LockKeyIcon class="size-4" />
		Proceed
	</Button>
</Dialog.Footer>
