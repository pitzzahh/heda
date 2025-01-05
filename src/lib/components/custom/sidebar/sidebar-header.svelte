<script lang="ts">
	import { Save, FileUp } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button';
	import { SettingsDialog, Settings } from '..';
	import { toast } from 'svelte-sonner';
	import type { Project, Node } from '@/db/schema';
	import UndoRedoButtons from './(components)/undo-redo-buttons.svelte';
	import { exportToExcel } from '@/helpers/export';
	import type { ButtonState } from '@/types/misc';

	let { project, root_node }: { project?: Project; root_node: Node } = $props();

	let component_state = $state({
		export_to_excel: 'idle' as ButtonState,
		settings_open: false
	});

	function handleSave() {
		// TODO: Implement save functionality
		toast.warning('This feature is not yet implemented');
	}
</script>

<div class="flex w-full items-center justify-between p-2">
	<div class="flex w-full items-center gap-2">
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					class={buttonVariants({ variant: 'default', size: 'sm' })}
					onclick={handleSave}
				>
					<Save class="h-4 w-4" />
					Save
				</Tooltip.Trigger>
				<Tooltip.Content>Save changes (Ctrl+S)</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<Tooltip.Provider>
			<Tooltip.Root bind:open={component_state.settings_open}>
				<Tooltip.Trigger>
					<Settings {project} bind:settings_open={component_state.settings_open} />
				</Tooltip.Trigger>
				<Tooltip.Content>New Settings</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<SettingsDialog {project} />
		<UndoRedoButtons />
	</div>
	<svelte:boundary>
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					disabled={component_state.export_to_excel === 'loading'}
					class={buttonVariants({ variant: 'outline', size: 'sm' })}
					onclick={() =>
						exportToExcel(
							root_node.id,
							root_node?.highest_unit_form,
							project?.project_name,
							() => (component_state.export_to_excel = 'idle'),
							() => (component_state.export_to_excel = 'loading')
						)}
				>
					<FileUp class="h-4 w-4" />
					Export to Excel
				</Tooltip.Trigger>
				<Tooltip.Content>Export project to excel</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		{#snippet failed(error, reset)}
			<p class="text-sm text-muted-foreground">{error}</p>
			<Button onclick={reset}>oops! try again</Button>
		{/snippet}
	</svelte:boundary>
</div>
