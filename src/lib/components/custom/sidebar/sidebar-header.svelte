<script lang="ts">
	import ExcelJS, { type Alignment } from 'exceljs';
	import { Save, Moon, Sun, FileUp } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button';
	import { SettingsDialog } from '..';
	import { toast } from 'svelte-sonner';
	import { getOrdinalSuffix } from '@/utils/format';
	import { setMode, systemPrefersMode } from 'mode-watcher';
	import * as DropdownMenu from '@/components/ui/dropdown-menu';
	import { getSettingsState } from '@/hooks/settings-state.svelte';
	import type { Project, Node } from '@/db/schema';
	import { getComputedLoads, getNodeById } from '@/db/queries/index';
	import { dev } from '$app/environment';

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

	function setModeAndColor(mode: 'dark' | 'light') {
		settingsState.setThemeColor(settingsState.themeColor, mode);
		setMode(mode);
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

		async function processOnePhaseExcelPanelBoardSchedule(
			nodeId: string,
			parent?: Node,
			depth: number = 1
		): Promise<{
			valid: boolean;
			message?: string;
			is_system_error?: boolean;
			description?: string;
		}> {
			const children = await getComputedLoads(nodeId);

			if (
				depth === 1 &&
				(children.length === 0 || children.every((child) => child.node_type !== 'panel'))
			) {
				toast.warning('No panels found', { position: 'bottom-center' });
				return {
					valid: false,
					message: 'No panels found',
					description: 'Cannot proceed with the export.'
				};
			}

			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (child.node_type === 'root') {
					await processOnePhaseExcelPanelBoardSchedule(child.id, child, depth + 1);
				} else if (child.node_type === 'panel') {
					const panel_name = child.panel_data?.name ?? 'Unknown Panel';
					const panel_level = getOrdinalSuffix(depth + 1);
					dev && console.log(`Panel: ${panel_name} (${panel_level})`);

					let worksheet = workbook.getWorksheet(panel_level);
					if (!worksheet) {
						worksheet = workbook.addWorksheet(panel_level);
					}

					const startRow = worksheet.rowCount > 0 ? worksheet.rowCount + 1 : 1;

					const description_label_column_position_data = [
						{ column: `A${startRow}`, value: 'DESCRIPTION' },
						{ column: `A${startRow + 1}`, value: 'SUPPLY' },
						{ column: `A${startRow + 2}`, value: 'FROM' },
						{ column: `A${startRow + 3}`, value: 'NAME' }
					];

					description_label_column_position_data.forEach(
						({ column, value }) => (worksheet.getCell(column).value = value)
					);

					worksheet.getCell(`B${startRow}`).value = `: PANELBOARD SCHEDULE`;
					worksheet.getCell(`B${startRow + 1}`).value =
						`: ${highest_unit?.phase} + E, ${230}V, ${60}Hz`;
					worksheet.getCell(`B${startRow + 2}`).value =
						`: ${parent?.panel_data?.name?.toUpperCase() ?? 'Transformer'}`;
					worksheet.getCell(`B${startRow + 3}`).value = `: ${panel_name}`;

					description_label_column_position_data
						.map((e) => e.column)
						.forEach((cell) => {
							worksheet.getCell(cell).font = { bold: true };
						});

					type Header = { text: string; cols: number; subText?: string };

					const table_headers: Header[] = [
						{ text: ' ', cols: 1, subText: 'CKT NO.' },
						{ text: ' ', cols: 1, subText: 'LOAD DESCRIPTION' },
						{ text: ' ', cols: 1, subText: 'VOLTAGE (V)' },
						{ text: ' ', cols: 1, subText: 'APPARENT POWER (VA)' },
						{ text: ' ', cols: 1, subText: 'CURRENT (A)' },
						{ text: 'CIRCUIT BREAKER', cols: 4 },
						{ text: 'CONDUCTOR', cols: 4 },
						{ text: 'EGC', cols: 2 },
						{ text: 'CONDUIT', cols: 2 }
					];

					let current_header_column = 1;
					table_headers.forEach((header: Header) => {
						const cell = worksheet.getCell(startRow + 4, current_header_column);
						if (header.subText) {
							cell.value = header.text;
							cell.font = { bold: true };
							cell.alignment = { horizontal: 'center' };
							cell.border = { top: { style: 'thin' } };

							const subCell = worksheet.getCell(startRow + 5, current_header_column);
							subCell.value = header.subText;
							subCell.font = { bold: true };
							subCell.alignment = { horizontal: 'center' };
							subCell.border = { bottom: { style: 'thick' } };
						} else if (header.cols === 1) {
							worksheet.mergeCells(
								startRow + 4,
								current_header_column,
								startRow + 5,
								current_header_column
							);
							cell.value = header.text;
							cell.font = { bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
							cell.border = { bottom: { style: 'thick' }, top: { style: 'thin' } };
						} else {
							worksheet.mergeCells(
								startRow + 4,
								current_header_column,
								startRow + 4,
								current_header_column + header.cols - 1
							);
							cell.value = header.text;
							cell.font = { bold: true };
							cell.alignment = { horizontal: 'center' };
							cell.border = { top: { style: 'thin' } };

							const subHeadersMap: Record<string, string[]> = {
								'CIRCUIT BREAKER': ['AT', 'AF', 'Pole', 'kAIC'],
								CONDUCTOR: ['Sets', 'Qty', 'Size\n(mm2)', 'Insulation'],
								EGC: ['Size', 'Insulation'],
								CONDUIT: ['Size', 'Insulation']
							};

							if (subHeadersMap[header.text]) {
								subHeadersMap[header.text].forEach((text, i) => {
									const subCell = worksheet.getCell(startRow + 5, current_header_column + i);
									subCell.value = text;
									subCell.font = { bold: true };
									subCell.alignment = { horizontal: 'center' };
									subCell.border = { bottom: { style: 'thick' } };
								});
							}
						}
						current_header_column += header.cols;
					});

					worksheet.columns = [
						{ width: 15 },
						{ width: 30 },
						{ width: 15 },
						{ width: 30 },
						{ width: 15 },
						{ width: 10 },
						{ width: 10 },
						{ width: 10 },
						{ width: 10 },
						{ width: 10 },
						{ width: 10 },
						{ width: 15 },
						{ width: 15 },
						{ width: 15 },
						{ width: 15 },
						{ width: 10 },
						{ width: 15 }
					];

					const loads = await getComputedLoads(child.id);
					let current_load_row = startRow + 7;

					for (const load of loads) {
						const loadCells = [
							{ column: 'A', value: load.circuit_number },
							{ column: 'B', value: load.load_description },
							{ column: 'C', value: load.voltage },
							{ column: 'D', value: load.va },
							{ column: 'E', value: load.current },
							{ column: 'F', value: load.at },
							{ column: 'G', value: load.ampere_frames },
							{ column: 'H', value: load.pole },
							{ column: 'I', value: load.kaic },
							{ column: 'J', value: load.conductor_sets },
							{ column: 'K', value: load.conductor_qty },
							{ column: 'L', value: load.conductor_size },
							{ column: 'M', value: load.conductor_insulation },
							{ column: 'N', value: load.egc_size },
							{ column: 'O', value: load.egc_insulation },
							{ column: 'P', value: load.conduit_size },
							{ column: 'Q', value: load.conduit_type }
						];

						loadCells.forEach(({ column, value }) => {
							const cell = worksheet.getCell(`${column}${current_load_row}`);
							cell.value = value;
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
							cell.border = { bottom: { style: 'thin' } };
						});
						current_load_row++;
					}

					const node_data_summary = await getNodeById(child.id);

					if (!node_data_summary) {
						return {
							valid: false,
							message: 'Failed to get MAIN data',
							is_system_error: true
						};
					}

					const main_columns = [
						{ column: 'A', value: 'TOTAL' },
						{ column: 'B', value: 'MAIN' },
						{ column: 'C', value: node_data_summary.voltage.toString() },
						{ column: 'D', value: node_data_summary.va.toString() },
						{ column: 'E', value: node_data_summary.current.toString() },
						{ column: 'F', value: node_data_summary.at.toString() },
						{ column: 'G', value: node_data_summary.ampere_frames.toString() },
						{ column: 'H', value: node_data_summary.pole ?? 'N/A' },
						{ column: 'I', value: node_data_summary.kaic ?? 'N/A' },
						{ column: 'J', value: node_data_summary.conductor_sets?.toString() ?? 'N/A' },
						{ column: 'K', value: node_data_summary.conductor_qty?.toString() ?? 'N/A' },
						{ column: 'L', value: node_data_summary.conductor_size.toString() },
						{ column: 'M', value: node_data_summary.conductor_insulation ?? 'N/A' },
						{ column: 'N', value: node_data_summary.egc_size.toString() },
						{ column: 'O', value: node_data_summary.egc_insulation ?? 'N/A' },
						{ column: 'P', value: node_data_summary.conduit_size.toString() },
						{ column: 'Q', value: node_data_summary.conduit_type ?? 'N/A' }
					];

					main_columns.forEach(({ column, value }) => {
						const cell = worksheet.getCell(`${column}${current_load_row}`);
						cell.value = value;
						cell.font = { bold: true };
						cell.alignment = { vertical: 'middle', horizontal: 'center' };
						cell.border = { top: { style: 'thin' }, bottom: { style: 'thick' } };
					});

					// Add empty row after main columns
					const emptyRow = worksheet.getRow(current_load_row + 1);
					emptyRow.height = 15; // Optional: set specific height for consistency

					await processOnePhaseExcelPanelBoardSchedule(child.id, child, depth + 1);
				}
			}

			return { valid: true };
		}

		try {
			switch (highest_unit?.phase) {
				case '1P':
					workbook.subject = '1P Load Schedule';
					workbook.category = ['1P', 'Load Schedule', 'Export'].join(',');
					workbook.description = 'Load schedule for 1 phase load schedule';
					const process_result = await processOnePhaseExcelPanelBoardSchedule(root_node.id);
					if (!process_result.valid) {
						button_states.export_to_excel = 'idle';
						toast.warning(process_result.message ?? 'Something went wrong while exporting', {
							description: process_result?.is_system_error
								? 'This is a system error and should not be here, the error has been logged.'
								: (process_result?.description ?? undefined),
							position: 'bottom-center'
						});
						return;
					}
					break;
				case '3P':
					workbook.subject = '3P Load Schedule';
					workbook.category = ['3P', 'Load Schedule', 'Export'].join(',');
					workbook.description = 'Load schedule for 3 phase load schedule';
					toast.warning('This feature is still under development', {
						description: 'Three phase load schedule is not yet supported',
						position: 'bottom-center'
					});
					return;
				default:
					button_states.export_to_excel = 'idle';
					workbook.subject = 'Unknown Load Schedule';
					toast.warning('Something went wrong while exporting', {
						description:
							'This is a system error and should not be here, the error has been logged.',
						position: 'bottom-center'
					});
					return;
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

		<DropdownMenu.Root>
			<DropdownMenu.Trigger class={buttonVariants({ variant: 'outline', size: 'icon' })}>
				<Sun
					class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
				/>
				<Moon
					class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
				/>
				<span class="sr-only">Toggle theme</span>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				<DropdownMenu.Item onclick={() => setModeAndColor('light')}>Light</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => setModeAndColor('dark')}>Dark</DropdownMenu.Item>
				<DropdownMenu.Item
					onclick={() => setModeAndColor($systemPrefersMode === 'light' ? 'light' : 'dark')}
				>
					System
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
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
