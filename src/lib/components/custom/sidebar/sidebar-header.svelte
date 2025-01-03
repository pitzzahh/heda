<script lang="ts">
	import ExcelJS from 'exceljs';
	import { Save, FileUp } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button';
	import { SettingsDialog } from '..';
	import { toast } from 'svelte-sonner';
	import { getSettingsState } from '@/hooks/settings-state.svelte';
	import type { Project, Node } from '@/db/schema';
	import { dev } from '$app/environment';
	import UndoRedoButtons from './(components)/undo-redo-buttons.svelte';
	import { exportToExcel, processOnePhaseExcelPanelBoardSchedule } from '@/helpers/export';
	import type { ButtonState } from '@/types/misc';

	let { project, root_node }: { project?: Project; root_node: Node } = $props();

	let button_states = $state({
		export_to_excel: 'idle' as ButtonState
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
		<SettingsDialog {project} />
		<UndoRedoButtons />
	</div>
	<svelte:boundary>
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger
					disabled={button_states.export_to_excel === 'loading'}
					class={buttonVariants({ variant: 'outline', size: 'sm' })}
					onclick={() =>
						exportToExcel(
							root_node.id,
							root_node?.highest_unit_form,
							undefined,
							project?.project_name,
							() => (button_states.export_to_excel = 'idle'),
							() => (button_states.export_to_excel = 'loading')
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
