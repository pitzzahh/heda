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
	import { generateUniqueFileName, doesFileExists, BASE_DIR_PATH, BASE_DIR } from '@/helpers/file';
	import { validateEnv } from '@/utils/validation';
	import { getProjectState } from '@/hooks/project-state.svelte';

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

					const created_proj = (await createProject(form.data)) as {
						project: Project;
						root_node_id: string;
					};

					const project_name = created_proj.project?.project_name ?? 'Untitled';
					let file_name = `${project_name}.heda`;

					// if appended_name is not same, we update the project title
					if (await doesFileExists(file_name, { baseDir: BASE_DIR })) {
						file_name = await generateUniqueFileName(project_name, BASE_DIR);
						console.log('new_file_name', file_name);
						await updateProjectTitle(created_proj.project.id, file_name);
						toast.info('Project title already exists, we will rename it for you.', {
							description: 'The project title is appended with a number to avoid conflicts.'
						});
					}

					console.log({ file_name });
					const created_file = await writeEncryptedFile(
						file_name,
						{
							project: created_proj.project,
							nodes: await getAllChildNodes(created_proj.root_node_id, true)
						},
						keyToString(generateKey(app_pass_phrase!, file_encryption_salt!))
					);
					await invalidate('app:workspace');
					closeDialog();

					const recent_project = {
						project_name: created_proj.project.project_name,
						project_path: '',
						exists: true
					};

					project_state.addRecentProject(recent_project);
					goto(
						`/workspace/load-schedule/${form.data.distribution_unit}_${created_proj.root_node_id}`
					).finally(() => toast.success('Project created successfully'));
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
