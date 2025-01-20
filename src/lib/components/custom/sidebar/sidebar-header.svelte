<script lang="ts">
	import { Save, Sheet, ArrowRightFromLine } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button';
	import { Settings } from '..';
	import { toast } from 'svelte-sonner';
	import type { Project, Node } from '@/db/schema';
	import { UndoRedoButtons } from './(components)';
	import { exportToExcel } from '@/helpers/export';
	import type { ButtonState } from '@/types/misc';
	import type { FileExport } from '@/types/main';
	import { generateKey, keyToString } from '@/helpers/security';
	import { writeEncryptedFile } from '@/helpers/file';
	import { getAllChildNodes } from '@/db/queries';
	import { validateEnv } from '@/utils/validation';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { getSettingsState } from '@/hooks/settings-state.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';

	let {
		project,
		root_node,
		app_pass_phrase,
		file_encryption_salt
	}: {
		project?: Project;
		root_node: Node;
		app_pass_phrase: string | null;
		file_encryption_salt: string | null;
	} = $props();

	let component_state = $state({
		export_to_excel: 'idle' as ButtonState,
		can_save: true
	});

	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();
	const project_state = getProjectState();

	async function handleSave() {
		try {
			if (!validateEnv(app_pass_phrase, file_encryption_salt)) return;
			if (!project) {
				return toast.warning('Failed to save, no project found', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}

			const file_data: FileExport = {
				project,
				nodes: await getAllChildNodes(project.root_node_id, true)
			};

			console.log(`New Data Saved: ${JSON.stringify(file_data)}`);

			await writeEncryptedFile(
				file_data,
				keyToString(generateKey(app_pass_phrase!, file_encryption_salt!)),
				project_state.current_project_path
			);
			undo_redo_state.resetUnsavedActions();
		} catch (err) {
			console.error(`Failed to save file: ${JSON.stringify(err)}`);
			toast.error(`Failed to save file: ${(err as any)?.message ?? 'something went wrong'}`, {
				description: 'An error occurred while saving the file.'
			});
		}

		if (!settings_state.auto_save_enabled) {
			toast.success('Saved successfully');
		}
	}

	$effect(() => {
		// auto saver
		if (undo_redo_state.has_unsaved_actions && settings_state.auto_save_enabled) {
			handleSave();
		}
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.ctrlKey && e.key.toLocaleLowerCase() === 's' && !settings_state.auto_save_enabled) {
			handleSave();
		}
	}}
/>

<div class="flex w-full items-center justify-between p-2">
	<div class="flex w-full items-center gap-2">
		{#if !settings_state.auto_save_enabled}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger
						disabled={project === undefined ||
							!component_state.can_save ||
							!undo_redo_state.has_unsaved_actions}
						class={buttonVariants({ variant: 'default', size: 'sm' })}
						onclick={handleSave}
					>
						<Save class="h-4 w-4" />
						Save
					</Tooltip.Trigger>
					<Tooltip.Content>Save changes (Ctrl+S)</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}

		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Settings {project} />
				</Tooltip.Trigger>
				<Tooltip.Content>Settings</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<UndoRedoButtons />
	</div>
	<svelte:boundary>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={buttonVariants({ variant: 'outline' })}>
				<ArrowRightFromLine class="h-4 w-4" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="flex w-fit flex-col gap-2">
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading>Export options</DropdownMenu.GroupHeading>
					<DropdownMenu.Separator />

					<DropdownMenu.Item
						disabled={component_state.export_to_excel === 'loading'}
						onclick={() =>
							exportToExcel(
								root_node.id,
								root_node?.highest_unit_form,
								project?.project_name,
								() => (component_state.export_to_excel = 'idle'),
								() => (component_state.export_to_excel = 'loading')
							)}><Sheet class="h-4 w-4" />Export whole project load schedule</DropdownMenu.Item
					>
					<DropdownMenu.Item
						><Sheet class="h-4 w-4" /> Export whole project voltage drop
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		{#snippet failed(error, reset)}
			<p class="text-sm text-muted-foreground">{error}</p>
			<Button onclick={reset}>Something went horribly wrong. Click to FIX me</Button>
		{/snippet}
	</svelte:boundary>
</div>
