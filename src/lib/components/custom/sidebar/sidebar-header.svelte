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
	import { processOnePhaseExcelPanelBoardSchedule } from '@/helpers/export';

	let { project, root_node }: { project?: Project; root_node: Node } = $props();

	const settingsState = getSettingsState();

	type ButtonState = 'idle' | 'loading';

	let button_states = $state({
		export_to_excel: 'idle' as ButtonState
	});

	function handleSave() {
		// TODO: Implement save functionality
		toast.warning('This feature is not yet implemented');
	}

	async function exportToExcel() {
		dev && console.log('Root:', root_node);
		if (!root_node) {
			return toast.warning('No project found', {
				description: 'Cannot proceed with the export.',
				position: 'bottom-center'
			});
		}

		const highest_unit = root_node?.highest_unit_form;
		if (!highest_unit) {
			return toast.warning('No highest unit found, nothing to export', {
				description: 'This is a system error and should not be here, the error has been logged.',
				position: 'bottom-center'
			});
		}
		const file_name = project?.project_name ?? 'Exported Panelboard Schedule';
		button_states.export_to_excel = 'loading';
		toast.info(`Exporting to Excel... ${file_name}.xlsx`, {
			description: 'Please wait, this should last very long.',
			position: 'bottom-center'
		});

		const workbook = new ExcelJS.Workbook();
		workbook.title = 'Exported Panelboard Schedule';
		workbook.creator = 'HEDA(Desktop App)';

		try {
			switch (highest_unit?.phase) {
				case '1P':
					workbook.subject = '1P Load Schedule';
					workbook.category = ['1P', 'Load Schedule', 'Export'].join(',');
					workbook.description = 'Load schedule for 1 phase load schedule';
					const process_result = await processOnePhaseExcelPanelBoardSchedule(
						workbook,
						root_node.id,
						highest_unit
					);
					if (!process_result.valid) {
						button_states.export_to_excel = 'idle';
						return toast.warning(process_result.message ?? 'Something went wrong while exporting', {
							description: process_result?.is_system_error
								? 'This is a system error and should not be here, the error has been logged.'
								: (process_result?.description ?? undefined),
							position: 'bottom-center'
						});
					}
					break;
				case '3P':
					workbook.subject = '3P Load Schedule';
					workbook.category = ['3P', 'Load Schedule', 'Export'].join(',');
					workbook.description = 'Load schedule for 3 phase load schedule';
					return toast.warning('This feature is still under development', {
						description: 'Three phase load schedule is not yet supported',
						position: 'bottom-center'
					});
				default:
					button_states.export_to_excel = 'idle';
					workbook.subject = 'Unknown Load Schedule';
					return toast.warning('Something went wrong while exporting', {
						description:
							'This is a system error and should not be here, the error has been logged.',
						position: 'bottom-center'
					});
			}
		} catch (e) {
			button_states.export_to_excel = 'idle';
			return toast.warning(`Something went wrong while exporting:: ${e?.toString()}`, {
				description: 'This is a system error and should not be here, the error has been logged.',
				position: 'bottom-center'
			});
		}

		// Write the workbook and trigger download
		const buffer = await workbook.xlsx.writeBuffer();
		const blob = new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
		});
		const url = URL.createObjectURL(blob);

		// Create a link and download the file
		const link = document.createElement('a');
		link.href = url;
		link.download = `${file_name}.xlsx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// Free resources
		URL.revokeObjectURL(url);
		toast.success('Export finished successfully.', {
			description: 'The file has been downloaded successfully',
			position: 'bottom-center'
		});
		button_states.export_to_excel = 'idle';
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
					onclick={exportToExcel}
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
