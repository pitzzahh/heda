<script lang="ts" module>
	import {
		CheckIcon,
		CircleNotchIcon,
		ExportIcon,
		FloppyDiskIcon,
		TableIcon
	} from '#lib/assets/icons';
	import type { Node } from '#lib/types/db';

	interface Props {
		root_node: Node;
	}
</script>

<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip';
	import { Button, buttonVariants } from '#lib/components/ui/button';
	import { Settings } from '..';
	import { toast } from 'svelte-sonner';
	import { UndoRedoButtons } from './(components)';
	import { exportToExcel } from '#lib/helpers/export';
	import type { ButtonState } from '#lib/types/misc';
	import type { FileExport } from '#lib/types/main';
	import { getSessionPassword } from '#lib/db/session';
	import { writeEncryptedFile } from '#lib/helpers/file';
	import { getAllChildNodes, getCurrentProject } from '#lib/db/queries';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte';
	import { getProjectState } from '#lib/hooks/project-state.svelte';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Portal } from 'bits-ui';
	import { cn } from '#lib/utils';
	let { root_node }: Props = $props();

	let component_state = $state({
		export_to_excel: 'idle' as ButtonState,
		can_save: true,
		saving: false
	});

	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();
	const project_state = getProjectState();

	async function handleSave() {
		if (component_state.saving) return;
		component_state.saving = true;
		try {
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

			const session_password = getSessionPassword();
			if (!session_password) {
				console.error('Failed to save, no session password');
				return toast.warning('Failed to save, no session password', {
					description: 'Reload the file and try again.'
				});
			}
			await writeEncryptedFile(file_data, session_password, project_state.current_project_path);
			undo_redo_state.resetUnsavedActions();
		} catch (err) {
			console.error(`Failed to save file: ${JSON.stringify(err)}`);
			toast.error(`Failed to save file: ${(err as Error)?.message ?? 'something went wrong'}`, {
				description: 'An error occurred while saving the file.'
			});
		} finally {
			component_state.saving = false;
		}

		if (!settings_state.auto_save_enabled) {
			toast.success('Saved successfully');
		}
	}

	// Auto-saver: persists to disk whenever unsaved actions appear while enabled.
	$effect(() => {
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

<div
	class="border-sidebar-border flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b px-2"
>
	<div
		class="border-sidebar-border/60 bg-sidebar-accent/40 flex items-center gap-0.5 rounded-lg border p-0.5"
	>
		{#if !settings_state.auto_save_enabled}
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger
						disabled={!project_state.loaded ||
							!component_state.can_save ||
							!undo_redo_state.has_unsaved_actions ||
							component_state.saving}
						class={buttonVariants({
							variant: undo_redo_state.has_unsaved_actions ? 'default' : 'ghost',
							size: 'sm'
						})}
						onclick={() => handleSave()}
					>
						<CircleNotchIcon
							class={cn('hidden size-4 animate-spin', { block: component_state.saving })}
						/>
						{#if undo_redo_state.has_unsaved_actions}
							<FloppyDiskIcon class={cn('size-4', { hidden: component_state.saving })} />
							Save
						{:else}
							<CheckIcon class={cn('size-4', { hidden: component_state.saving })} />
							Saved
						{/if}
					</Tooltip.Trigger>
					<Tooltip.Content>
						{undo_redo_state.has_unsaved_actions ? 'Save changes (Ctrl+S)' : 'All changes saved'}
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}

		<Settings />
		<UndoRedoButtons />
	</div>
	<svelte:boundary>
		<DropdownMenu.Root>
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger disabled={!project_state.loaded}>
						{#snippet child({ props })}
							<DropdownMenu.Trigger
								{...props}
								disabled={!project_state.loaded}
								class={buttonVariants({
									variant: 'outline',
									size: 'icon-sm'
								})}
								aria-label="Export options"
							>
								<ExportIcon class="size-4" />
							</DropdownMenu.Trigger>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>Export</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>

			<Portal>
				<DropdownMenu.Content class="z-50 flex w-fit flex-col gap-2">
					<DropdownMenu.Group>
						<DropdownMenu.Label class="text-center">Export options</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Item
							disabled={component_state.export_to_excel === 'loading'}
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
							<CircleNotchIcon
								class={cn('mr-0.5 hidden h-4 w-4 animate-spin', {
									block: component_state.export_to_excel === 'loading'
								})}
							/>
							<TableIcon
								class={cn('mr-0.5 block h-4 w-4', {
									'opacity-50': component_state.export_to_excel === 'loading'
								})}
							/>
							Export whole project load schedule</DropdownMenu.Item
						>
						<DropdownMenu.Item
							disabled={component_state.export_to_excel === 'loading'}
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
							<CircleNotchIcon
								class={cn('mr-0.5 hidden h-4 w-4 animate-spin', {
									block: component_state.export_to_excel === 'loading'
								})}
							/>
							<TableIcon
								class={cn('mr-0.5 block h-4 w-4', {
									'opacity-50': component_state.export_to_excel === 'loading'
								})}
							/>
							Export whole project voltage drop</DropdownMenu.Item
						>
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</Portal>
		</DropdownMenu.Root>
		{#snippet failed(error, reset)}
			<div class="grid w-full gap-2 rounded-xl border border-dashed p-3">
				<p class="text-muted-foreground text-xs">{error}</p>
				<Button onclick={reset} size="sm" variant="outline">Try again</Button>
			</div>
		{/snippet}
	</svelte:boundary>
</div>
