<script lang="ts">
	import { Save, Loader, Sheet, ArrowRightFromLine } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button';
	import { Settings } from '..';
	import { toast } from 'svelte-sonner';
	import type { Node } from '@/db/schema';
	import { UndoRedoButtons } from './(components)';
	import { exportToExcel } from '@/helpers/export';
	import type { ButtonState } from '@/types/misc';
	import type { FileExport } from '@/types/main';
	import { generateKey, keyToString } from '@/helpers/security';
	import { writeEncryptedFile } from '@/helpers/file';
	import { getAllChildNodes, getCurrentProject } from '@/db/queries';
	import { validateEnv } from '@/utils/validation';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { getSettingsState } from '@/hooks/settings-state.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';
	import { Portal } from 'bits-ui';
	import { cn } from '@/utils';
	let {
		root_node,
		app_pass_phrase,
		file_encryption_salt
	}: {
		root_node: Node;
		app_pass_phrase: string | null;
		file_encryption_salt: string | null;
	} = $props();

	let component_state = $state({
		export_to_excel: 'idle' as ButtonState,
		status: 'idle' as 'idle' | 'processing',
		can_save: true
	});

	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();
	const project_state = getProjectState();

	async function handleSave() {
		try {
			if (!validateEnv(app_pass_phrase, file_encryption_salt)) return;
			if (!project_state.loaded) {
				console.error('Failed to save, project not yet loaded');
				return toast.warning('Failed to save, project not yet loaded', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}

			const current_project = await getCurrentProject();

			if (!current_project) {
				console.error('Failed to save, no project found');
				return toast.warning('Failed to save, no project found', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}

			const file_data: FileExport = {
				project: current_project,
				nodes: await getAllChildNodes(current_project.root_node_id, true)
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
						disabled={!project_state.loaded ||
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
					<Settings />
				</Tooltip.Trigger>
				<Tooltip.Content>Settings</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<UndoRedoButtons />
	</div>
	<svelte:boundary>
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					disabled={!project_state.loaded}
					class={cn({
						'cursor-not-allowed': !project_state.loaded
					})}
				>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							disabled={!project_state.loaded}
							class={buttonVariants({
								variant: 'outline'
							})}
						>
							<ArrowRightFromLine class="h-4 w-4" />
						</DropdownMenu.Trigger>

						<Portal>
							<DropdownMenu.Content class="z-50 flex w-fit flex-col gap-2">
								<DropdownMenu.Group>
									<DropdownMenu.GroupHeading class="text-center"
										>Export options</DropdownMenu.GroupHeading
									>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										disabled={component_state.status === 'processing'}
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
										<Loader
											class={cn('mr-0.5 hidden h-4 w-4 animate-spin', {
												block: component_state.status === 'processing'
											})}
										/>
										<Sheet
											class={cn('mr-0.5 block h-4 w-4', {
												'opacity-50': component_state.export_to_excel === 'loading'
											})}
										/>
										Export whole project load schedule</DropdownMenu.Item
									>
									<DropdownMenu.Item
										disabled={component_state.status === 'processing'}
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
										<Loader
											class={cn('mr-0.5 hidden h-4 w-4 animate-spin', {
												block: component_state.status === 'processing'
											})}
										/>
										<Sheet
											class={cn('mr-0.5 block h-4 w-4', {
												'opacity-50': component_state.export_to_excel === 'loading'
											})}
										/>
										Export whole project voltage drop
									</DropdownMenu.Item>
								</DropdownMenu.Group>
							</DropdownMenu.Content>
						</Portal>
					</DropdownMenu.Root>
				</Tooltip.Trigger>
				<Tooltip.Content>Export</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		{#snippet failed(error, reset)}
			<p class="text-sm text-muted-foreground">{error}</p>
			<Button onclick={reset}>oops! try again</Button>
		{/snippet}
	</svelte:boundary>
</div>
