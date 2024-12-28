<script lang="ts">
	import ExcelJS from 'exceljs';
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
	import { getChildNodesByParentId } from '@/db/queries/index';

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
		console.log('Root:', root_node);
		if (!root_node) {
			toast.warning('No project found, nothing to export');
			return;
		}

		const workbook = new ExcelJS.Workbook();

		async function processNodeChildren(nodeId: string, parent?: Node, depth: number = 1) {
			const children = await getChildNodesByParentId(nodeId);
			if (depth === 1 && children.length === 0) {
				toast.warning('No panels/loads found');
				return false;
			}
			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (child.node_type === 'root') {
					await processNodeChildren(child.id, child, depth + 1);
				} else if (child.node_type === 'panel') {
					const panel_name = child.panel_data?.name ?? 'Unknown Panel';
					const panel_level = getOrdinalSuffix(depth + 1);
					console.log(`Panel: ${panel_name} (${panel_level})`);

					if (!workbook.getWorksheet(panel_level)) {
						const worksheet = workbook.addWorksheet(panel_level);

						// Add headers
						[
							{ cell: 'A1', value: 'DESCRIPTION' },
							{ cell: 'A2', value: 'SUPPLY' },
							{ cell: 'A3', value: 'FROM' },
							{ cell: 'A4', value: 'NAME' },
							{ cell: 'J3', value: 'USE' },
							{ cell: 'J4', value: 'FEEDER' }
						].forEach(({ cell, value }) => (worksheet.getCell(cell).value = value));

						worksheet.getCell('B1').value = `: PANELBOARD SCHEDULE`;
						worksheet.getCell('B3').value = `: ${parent?.panel_data?.name ?? '--'}`;
						worksheet.getCell('B4').value = `: ${panel_name}`;

						// Bold formatting to all headers
						['A1', 'A2', 'A3', 'A4', 'J3', 'J4'].forEach((cell) => {
							worksheet.getCell(cell).font = { bold: true };
						});

						// Set headers for load schedule with styling.
						type Header = { text: string; cols: number; subText?: string };
						const headers: Header[] = [
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

						let currentCol = 1;
						headers.forEach((header: Header) => {
							const cell = worksheet.getCell(5, currentCol);
							if (header.subText) {
								cell.value = header.text;
								cell.font = { bold: true };
								cell.alignment = { horizontal: 'center' };
								cell.border = { top: { style: 'thin' } };

								const subCell = worksheet.getCell(6, currentCol);
								subCell.value = header.subText;
								subCell.font = { bold: true };
								subCell.alignment = { horizontal: 'center' };
								subCell.border = { bottom: { style: 'thick' } };
							} else if (header.text === 'AB' || header.text === 'CA') {
								const top_cell = worksheet.getCell(5, currentCol);
								top_cell.border = { top: { style: 'thin' } };

								const cell = worksheet.getCell(6, currentCol);
								cell.value = header.text;
								cell.font = { bold: true };
								cell.alignment = { horizontal: 'center' };
								cell.border = { bottom: { style: 'thick' } };
							} else if (header.cols === 1) {
								worksheet.mergeCells(5, currentCol, 6, currentCol);
								cell.value = header.text;
								cell.font = { bold: true };
								cell.alignment = { vertical: 'middle', horizontal: 'center' };
								cell.border = { bottom: { style: 'thick' }, top: { style: 'thin' } };
							} else {
								worksheet.mergeCells(5, currentCol, 5, currentCol + header.cols - 1);
								const cell = worksheet.getCell(5, currentCol);
								cell.value = header.text;
								cell.font = { bold: true };
								cell.alignment = { horizontal: 'center' };
								cell.border = { top: { style: 'thin' } };

								// Sub-headers for circuit breaker
								if (header.text === 'CIRCUIT BREAKER') {
									const subHeaders: string[] = ['AT', 'AF', 'POLE'];
									subHeaders.forEach((text: string, i: number) => {
										const subCell = worksheet.getCell(6, currentCol + i);
										subCell.value = text;
										subCell.font = { bold: true };
										subCell.alignment = { horizontal: 'center' };
										subCell.border = { bottom: { style: 'thick' } };
									});
								}
							}
							currentCol += header.cols;
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
					}
					await processNodeChildren(child.id, child, depth + 1);
				}
				const node_type = parent?.node_type;
				console.log(
					`${node_type === 'root' ? parent?.highest_unit_form?.distribution_unit : node_type === 'panel' ? parent?.panel_data?.name : 'unknown'} - ${child.load_data?.load_description}`
				);
			}
			return true;
		}

		const is_valid = await processNodeChildren(root_node.id);
		if (!is_valid) return;

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
			<Tooltip.Content>New document</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
