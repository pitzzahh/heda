<script lang="ts">
	import ExcelJS, { type Alignment } from 'exceljs';
	import { Save, Moon, Sun, FileUp } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { buttonVariants } from '@/components/ui/button/index.js';
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
				description: 'Cannot proceed with the export.'
			});
		}

		const highest_unit = root_node?.highest_unit_form;
		if (!highest_unit) {
			return toast.warning('No highest unit found, nothing to export', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
		}

		const workbook = new ExcelJS.Workbook();

		async function processNodeChildren(
			nodeId: string,
			parent?: Node,
			depth: number = 1,
			end_row: number = 1 // Track row position for appending panels
		): Promise<{
			valid: boolean;
			message?: string;
			is_system_error?: boolean;
			description?: string;
		}> {
			const children = await getComputedLoads(nodeId);

			// bail out if there are no child panels on the root node
			if (
				depth === 1 &&
				(children.length === 0 || children.every((child) => child.node_type !== 'panel'))
			) {
				toast.warning('No panels found');
				return {
					valid: false,
					message: 'No panels found',
					description: 'Cannot proceed with the export.'
				};
			}

			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (child.node_type === 'root') {
					await processNodeChildren(child.id, child, depth + 1);
				} else if (child.node_type === 'panel') {
					const panel_name = child.panel_data?.name ?? 'Unknown Panel';
					const panel_level = getOrdinalSuffix(depth + 1);
					dev && console.log(`Panel: ${panel_name} (${panel_level})`);
					let worksheet = workbook.getWorksheet(panel_level);
					if (!worksheet) {
						end_row = 1;
						worksheet = workbook.addWorksheet(panel_level);
					}

					// Add headers
					const description_label_column_position_data = [
						{ column: `A${end_row}`, value: 'DESCRIPTION' },
						{ column: `A${end_row + 1}`, value: 'SUPPLY' },
						{ column: `A${end_row + 2}`, value: 'FROM' },
						{ column: `A${end_row + 3}`, value: 'NAME' }
					];
					description_label_column_position_data.forEach(
						({ column, value }) => (worksheet.getCell(column).value = value)
					);

					worksheet.getCell(`B${end_row}`).value = `: PANELBOARD SCHEDULE`;
					worksheet.getCell(`B${end_row + 1}`).value =
						`: ${highest_unit?.phase} + E, ${230}V, ${60}Hz`;
					worksheet.getCell(`B${end_row + 2}`).value =
						`: ${parent?.panel_data?.name?.toUpperCase() ?? 'Transformer'}`;
					worksheet.getCell(`B${end_row + 3}`).value = `: ${panel_name}`;

					// Bold formatting to all headers
					description_label_column_position_data
						.map((e) => e.column)
						.forEach((cell) => {
							worksheet.getCell(cell).font = { bold: true };
						});

					// Set headers for load schedule with styling.
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
						const cell = worksheet.getCell(end_row + 4, current_header_column);
						if (header.subText) {
							cell.value = header.text;
							cell.font = { bold: true };
							cell.alignment = { horizontal: 'center' };
							cell.border = { top: { style: 'thin' } };

							const subCell = worksheet.getCell(end_row + 5, current_header_column);
							subCell.value = header.subText;
							subCell.font = { bold: true };
							subCell.alignment = { horizontal: 'center' };
							subCell.border = { bottom: { style: 'thick' } };
						} else if (header.cols === 1) {
							worksheet.mergeCells(
								end_row + 4,
								current_header_column,
								end_row + 5,
								current_header_column
							);
							cell.value = header.text;
							cell.font = { bold: true };
							cell.alignment = { vertical: 'middle', horizontal: 'center' };
							cell.border = { bottom: { style: 'thick' }, top: { style: 'thin' } };
						} else {
							worksheet.mergeCells(
								end_row + 4,
								current_header_column,
								end_row + 4,
								current_header_column + header.cols - 1
							);
							const cell = worksheet.getCell(end_row + 4, current_header_column);
							cell.value = header.text;
							cell.font = { bold: true };
							cell.alignment = { horizontal: 'center' };
							cell.border = { top: { style: 'thin' } };

							// Sub-headers for circuit breaker
							if (header.text === 'CIRCUIT BREAKER') {
								const subHeaders: string[] = ['AT', 'AF', 'Pole', 'kAIC'];
								subHeaders.forEach((text: string, i: number) => {
									const subCell = worksheet.getCell(end_row + 5, current_header_column + i);
									subCell.value = text;
									subCell.font = { bold: true };
									subCell.alignment = { horizontal: 'center' };
									subCell.border = { bottom: { style: 'thick' } };
								});
							}

							// Sub-headers for conductor
							if (header.text === 'CONDUCTOR') {
								const subHeaders: string[] = ['Sets', 'Qty', 'Size\n(mm2)', 'Insulation'];
								subHeaders.forEach((text: string, i: number) => {
									const subCell = worksheet.getCell(end_row + 5, current_header_column + i);
									subCell.value = text;
									subCell.font = { bold: true };
									subCell.alignment = { horizontal: 'center' };
									subCell.border = { bottom: { style: 'thick' } };
								});
							}
							// Sub-headers for egc
							if (header.text === 'EGC') {
								const subHeaders: string[] = ['Size', 'Insulation'];
								subHeaders.forEach((text: string, i: number) => {
									const subCell = worksheet.getCell(end_row + 5, current_header_column + i);
									subCell.value = text;
									subCell.font = { bold: true };
									subCell.alignment = { horizontal: 'center' };
									subCell.border = { bottom: { style: 'thick' } };
								});
							}
							// Sub-headers for conduit
							if (header.text === 'CONDUIT') {
								const subHeaders: string[] = ['Size', 'Insulation'];
								subHeaders.forEach((text: string, i: number) => {
									const subCell = worksheet.getCell(end_row + 5, current_header_column + i);
									subCell.value = text;
									subCell.font = { bold: true };
									subCell.alignment = { horizontal: 'center' };
									subCell.border = { bottom: { style: 'thick' } };
								});
							}
						}
						current_header_column += header.cols;
					});

					// Set column widths
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

					// Get and write panel loads
					const loads = await getComputedLoads(child.id);
					console.log('loads data', loads);
					let last_row = end_row + 6;

					for (let j = 0; j < loads.length; j++) {
						const load = loads[j];

						const circuit_number_cell = worksheet.getCell(`A${last_row}`);
						const load_description_cell = worksheet.getCell(`B${last_row}`);
						const voltage_cell = worksheet.getCell(`C${last_row}`);
						const apparent_power_cell = worksheet.getCell(`D${last_row}`);
						const current_cell = worksheet.getCell(`E${last_row}`);
						const at_cell = worksheet.getCell(`F${last_row}`);
						const af_cell = worksheet.getCell(`G${last_row}`);
						const pole_cell = worksheet.getCell(`H${last_row}`);
						const kaic_cell = worksheet.getCell(`I${last_row}`);
						const conductor_sets_cell = worksheet.getCell(`J${last_row}`);
						const conductor_qty_cell = worksheet.getCell(`K${last_row}`);
						const conductor_size_cell = worksheet.getCell(`L${last_row}`);
						const conductor_insulation_cell = worksheet.getCell(`M${last_row}`);
						const egc_size_cell = worksheet.getCell(`N${last_row}`);
						const egc_insulation_cell = worksheet.getCell(`O${last_row}`);
						const conduit_size_cell = worksheet.getCell(`P${last_row}`);
						const conduit_type_cell = worksheet.getCell(`Q${last_row}`);

						const center_alignment_reference: Partial<ExcelJS.Alignment> = {
							vertical: 'middle',
							horizontal: 'center'
						};
						const bottom_border_reference: Partial<ExcelJS.Borders> = { bottom: { style: 'thin' } };

						circuit_number_cell.alignment = center_alignment_reference;
						circuit_number_cell.border = bottom_border_reference;

						load_description_cell.alignment = center_alignment_reference;
						load_description_cell.border = bottom_border_reference;

						voltage_cell.alignment = center_alignment_reference;
						voltage_cell.border = bottom_border_reference;

						apparent_power_cell.alignment = center_alignment_reference;
						apparent_power_cell.border = bottom_border_reference;

						current_cell.alignment = center_alignment_reference;
						current_cell.border = bottom_border_reference;

						at_cell.alignment = center_alignment_reference;
						at_cell.border = bottom_border_reference;

						af_cell.alignment = center_alignment_reference;
						af_cell.border = bottom_border_reference;

						pole_cell.alignment = center_alignment_reference;
						pole_cell.border = bottom_border_reference;

						kaic_cell.alignment = center_alignment_reference;
						kaic_cell.border = bottom_border_reference;

						conductor_sets_cell.alignment = center_alignment_reference;
						conductor_sets_cell.border = bottom_border_reference;

						conductor_qty_cell.alignment = center_alignment_reference;
						conductor_qty_cell.border = bottom_border_reference;

						conductor_size_cell.alignment = center_alignment_reference;
						conductor_size_cell.border = bottom_border_reference;

						conductor_insulation_cell.alignment = center_alignment_reference;
						conductor_insulation_cell.border = bottom_border_reference;

						egc_size_cell.alignment = center_alignment_reference;
						egc_size_cell.border = bottom_border_reference;

						egc_insulation_cell.alignment = center_alignment_reference;
						egc_insulation_cell.border = bottom_border_reference;

						conduit_size_cell.alignment = center_alignment_reference;
						conduit_size_cell.border = bottom_border_reference;

						conduit_type_cell.alignment = center_alignment_reference;
						conduit_type_cell.border = bottom_border_reference;

						circuit_number_cell.value = load.circuit_number;
						load_description_cell.value = load.load_description;
						voltage_cell.value = load.voltage;
						apparent_power_cell.value = load.va;
						current_cell.value = load.current;
						at_cell.value = load.at;
						af_cell.value = load.ampere_frames;
						pole_cell.value = load.pole;
						kaic_cell.value = load.kaic;
						conductor_sets_cell.value = load.conductor_sets;
						conductor_qty_cell.value = load.conductor_qty;
						conductor_size_cell.value = load.conductor_size;
						conductor_insulation_cell.value = load.conductor_insulation;
						egc_size_cell.value = load.egc_size;
						egc_insulation_cell.value = load.egc_insulation;
						conduit_size_cell.value = load.conduit_size;
						conduit_type_cell.value = load.conduit_type;
						last_row++;
					}
					// Add main total
					if (!worksheet) {
						return {
							valid: false,
							message: 'Failed to get worksheet of load level',
							is_system_error: true
						};
					}

					const node_data_summary = await getNodeById(child.id);

					if (!node_data_summary) {
						return {
							valid: false,
							message: 'Failed to get MAIN data',
							is_system_error: true
						};
					}

					console.log({ node_data_summary });

					const centerAlignment: Partial<Alignment> = {
						vertical: 'middle',
						horizontal: 'center'
					};

					const set_main_cell = (column: string, value: string) => {
						const cell = worksheet.getCell(`${column}${last_row}`);
						cell.value = value;
						cell.font = { bold: true };
						cell.alignment =
							column === 'B' ? { vertical: 'middle', horizontal: 'left' } : centerAlignment;
						cell.border = { bottom: { style: 'thin' } };
					};

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
						{ column: 'Q', value: ' ' }
					];

					main_columns.forEach(({ column, value }) => set_main_cell(column, value));

					// bottom part
					// const last_cell = worksheet.getCell(`A${last_row + 1}`);
					// last_cell.value =
					// 	`l(t) = 1.25 * ${node_data_summary.voltage} `;
					// 	last_cell.alignment = centerAlignment;
					// const last_total_cell = worksheet.getCell(`C${last_row + 1}`)
					// last_total_cell.value = 1.25 * node_data_summary.voltage;
					// last_total_cell.alignment = centerAlignment;

					end_row += last_row + 3;
					await processNodeChildren(child.id, child, depth + 1, last_row);
				}
				const node_type = parent?.node_type;
				dev &&
					console.log(
						`${node_type === 'root' ? parent?.highest_unit_form?.distribution_unit : node_type === 'panel' ? parent?.panel_data?.name : 'unknown'} - ${child.load_data?.load_description}`
					);
			}
			return {
				valid: true
			};
		}

		switch (highest_unit?.phase) {
			case '1P':
				workbook.subject = '1P Load Schedule';
				workbook.description = 'Load schedule for 1 phase load schedule';
				const process_result = await processNodeChildren(root_node.id);
				if (!process_result.valid) {
					toast.warning(process_result.message ?? 'Something went wrong while exporting', {
						description: process_result?.is_system_error
							? 'This is a system error and should not be here, the error has been logged.'
							: (process_result?.description ?? undefined)
					});
					return;
				}
				break;
			case '3P':
				workbook.subject = '3P Load Schedule';
				workbook.description = 'Load schedule for 3 phase load schedule';
				toast.warning('This feature is still under development', {
					description: 'Three phase load schedule is not yet supported'
				});
				return;
			default:
				workbook.subject = 'Unknown Load Schedule';
				toast.warning('Something went wrong while exporting', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
				return;
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
		link.download = `${project?.project_name ?? 'Exported Data'}.xlsx`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// Free resources
		URL.revokeObjectURL(url);
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
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger
				class={buttonVariants({ variant: 'outline', size: 'sm' })}
				onclick={exportToExcel}
			>
				<FileUp class="h-4 w-4" />
				Export to Excel
			</Tooltip.Trigger>
			<Tooltip.Content>Export project to excel</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
