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
	import { getComputedLoads } from '@/db/queries/index';
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
			toast.warning('No project found, nothing to export');
			return;
		}

		const highest_unit = root_node?.highest_unit_form;
		if (!highest_unit) {
			toast.warning('No highest unit found, nothing to export', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return;
		}

		const workbook = new ExcelJS.Workbook();

		async function processNodeChildren(
			nodeId: string,
			parent?: Node,
			depth: number = 1,
			end_row: number = 1 // Track row position for appending panels
		): Promise<{ valid: boolean; message?: string; is_system_error?: boolean }> {
			const children = await getComputedLoads(nodeId);

			// bail out if there are no child panels on the root node
			if (
				depth === 1 &&
				(children.length === 0 || children.every((child) => child.node_type !== 'panel'))
			) {
				toast.warning('No panels found');
				return { valid: false, message: 'No panels found' };
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
						`: ${parent?.panel_data?.name?.toUpperCase() ?? '--'}`;
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
						{ text: 'CKT NO.', cols: 1 },
						{ text: 'LOAD DESCRIPTION', cols: 1 },
						{ text: 'CAPACITY', cols: 1, subText: '(VA)' },
						{ text: 'VOLTAGE', cols: 1, subText: '(V)' },
						{ text: 'AB', cols: 1 },
						{ text: 'CURRENT', cols: 1, subText: 'BC' },
						{ text: 'CA', cols: 1 },
						{ text: 'CIRCUIT BREAKER', cols: 3 },
						{ text: 'FEEDER CONDUCTOR', cols: 1 },
						{ text: 'EGC', cols: 1 },
						{ text: 'CONDUIT', cols: 1 }
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
						} else if (header.text === 'AB' || header.text === 'CA') {
							const top_cell = worksheet.getCell(end_row + 4, current_header_column);
							top_cell.border = { top: { style: 'thin' } };

							const cell = worksheet.getCell(end_row + 5, current_header_column);
							cell.value = header.text;
							cell.font = { bold: true };
							cell.alignment = { horizontal: 'center' };
							cell.border = { bottom: { style: 'thick' } };
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
								const subHeaders: string[] = ['AT', 'AF', 'POLE'];
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
						{ width: 15 },
						{ width: 15 },
						{ width: 15 },
						{ width: 15 },
						{ width: 10 },
						{ width: 10 },
						{ width: 10 },
						{ width: 25 },
						{ width: 15 },
						{ width: 15 }
					];

					// Get and write panel loads
					const loads = await getComputedLoads(child.id);
					console.log('loads data', loads);
					let last_row = end_row + 6;

					for (let j = 0; j < loads.length; j++) {
						const load = loads[j];
						if (
							load.node_type === 'load' ||
							(load.node_type === 'panel' && (load.load_data || load.panel_data))
						) {
							const circuit_number_cell = worksheet.getCell(`A${last_row}`);
							const load_description_cell = worksheet.getCell(`B${last_row}`);
							const capacity_cell = worksheet.getCell(`C${last_row}`);
							const voltage_cell = worksheet.getCell(`D${last_row}`);
							const ab_cell = worksheet.getCell(`E${last_row}`);
							const current_bc_cell = worksheet.getCell(`F${last_row}`);
							const ca_cell = worksheet.getCell(`G${last_row}`);
							const at_cell = worksheet.getCell(`H${last_row}`);
							const af_cell = worksheet.getCell(`I${last_row}`);
							const pole_cell = worksheet.getCell(`J${last_row}`);
							const feeder_conductor_cell = worksheet.getCell(`K${last_row}`);
							const egc_cell = worksheet.getCell(`L${last_row}`);
							const conduit_cell = worksheet.getCell(`M${last_row}`);

							const center_alignment_reference: Partial<Alignment> = {
								vertical: 'middle',
								horizontal: 'center'
							};
							circuit_number_cell.alignment = center_alignment_reference;
							circuit_number_cell.border = { bottom: { style: 'thin' } };

							load_description_cell.alignment = { vertical: 'middle', horizontal: 'left' };
							load_description_cell.border = { bottom: { style: 'thin' } };

							capacity_cell.alignment = center_alignment_reference;
							capacity_cell.border = { bottom: { style: 'thin' } };

							voltage_cell.alignment = center_alignment_reference;
							voltage_cell.border = { bottom: { style: 'thin' } };

							ab_cell.alignment = center_alignment_reference;
							ab_cell.border = { bottom: { style: 'thin' } };

							current_bc_cell.alignment = center_alignment_reference;
							current_bc_cell.border = { bottom: { style: 'thin' } };

							ca_cell.alignment = center_alignment_reference;
							ca_cell.border = { bottom: { style: 'thin' } };

							at_cell.alignment = center_alignment_reference;
							at_cell.border = { bottom: { style: 'thin' } };

							af_cell.alignment = center_alignment_reference;
							af_cell.border = { bottom: { style: 'thin' } };

							pole_cell.alignment = center_alignment_reference;
							pole_cell.border = { bottom: { style: 'thin' } };

							feeder_conductor_cell.alignment = center_alignment_reference;
							feeder_conductor_cell.border = { bottom: { style: 'thin' } };

							egc_cell.alignment = center_alignment_reference;
							egc_cell.border = { bottom: { style: 'thin' } };

							conduit_cell.alignment = center_alignment_reference;
							conduit_cell.border = { bottom: { style: 'thin' } };

							if (load.node_type === 'load' && load.load_data) {
								const load_data = load.load_data;
								ab_cell.value = 'TBA';
								ca_cell.value = 'TBA';
								feeder_conductor_cell.value = 'TBA';
								egc_cell.value = 'TBA';
								conduit_cell.value = 'TBA';
							} else if (load.node_type === 'panel' && load.panel_data) {
								const panel_data = load.panel_data;
								voltage_cell.value = 'TBA';
								ab_cell.value = 'TBA';
								ca_cell.value = 'TBA';
								feeder_conductor_cell.value = 'TBA';
								egc_cell.value = 'TBA';
								conduit_cell.value = 'TBA';
							}
							circuit_number_cell.value = load.circuit_number;
							load_description_cell.value = load.load_description;
							voltage_cell.value = load.voltage;
							capacity_cell.value = load.va;
							at_cell.value = load.at;
							af_cell.value = load.overrided_ampere_frames;
							pole_cell.value = load.pole;
							last_row++;
						}
					}
					// Add main total
					if (!worksheet) {
						return {
							valid: false,
							message: 'Failed to get worksheet of load level',
							is_system_error: true
						};
					}
					const centerAlignment: Partial<Alignment> = {
						vertical: 'middle',
						horizontal: 'center'
					};

					const set_main_cell = (column: string, value: string) => {
						const cell = worksheet.getCell(`${column}${last_row}`);
						cell.value = value;
						cell.font = { bold: true };
						cell.alignment = centerAlignment;
						cell.border = { bottom: { style: 'thin' } };
					};

					const main_columns = [
						{ column: 'A', value: 'TOTAL' },
						{ column: 'B', value: ' ' },
						{ column: 'C', value: 'TBA' },
						{ column: 'D', value: '230' },
						{ column: 'E', value: 'TBA' },
						{ column: 'F', value: ' ' },
						{ column: 'G', value: ' ' },
						{ column: 'H', value: ' ' },
						{ column: 'I', value: ' ' },
						{ column: 'J', value: ' ' },
						{ column: 'K', value: ' ' },
						{ column: 'L', value: ' ' },
						{ column: 'M', value: ' ' }
					];

					main_columns.forEach(({ column, value }) => set_main_cell(column, value));

					end_row += last_row + 2;
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

		const process_result = await processNodeChildren(root_node.id);
		if (!process_result.valid) {
			toast.warning(process_result.message ?? 'Something went wrong while exporting', {
				description: process_result?.is_system_error
					? 'This is a system error and should not be here, the error has been logged.'
					: undefined
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
		toast.warning('This feature is still under development');
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
