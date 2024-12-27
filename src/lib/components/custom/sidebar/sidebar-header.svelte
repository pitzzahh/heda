<script lang="ts">
	import * as XLSX from 'xlsx';
	import { Save, FilePlus, Moon, Sun, FileUp } from '@/assets/icons';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import { SettingsDialog } from '..';
	import { toast } from 'svelte-sonner';
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

	function handleNew() {
		// TODO: Implement new document functionality
		toast.warning('This feature is not yet implemented');
	}

	function setModeAndColor(mode: 'dark' | 'light') {
		settingsState.setThemeColor(settingsState.themeColor, mode);
		setMode(mode);
	}

	async function exportToExcel() {
		console.log('Root:', root_node);
		if (!root_node) {
			toast.warning('No root node found');
			return;
		}
		async function processNodeChildren(nodeId: string, parent?: Node) {
			const children = await getChildNodesByParentId(nodeId);
			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (child.node_type === 'root') {
					await processNodeChildren(child.id, child);
				} else if (child.node_type === 'panel') {
					const panel_name = child.panel_data?.name;
					console.log('Panel:', panel_name);
					await processNodeChildren(child.id, child);
				}
				const node_type = parent?.node_type;
				console.log(
					`${node_type === 'root' ? parent?.highest_unit_form?.distribution_unit : node_type === 'panel' ? parent?.panel_data?.name : 'unknown'} - ${child.load_data?.load_description}`
				);
			}
			return children;
		}

		await processNodeChildren(root_node.id);

		// // Create a new worksheet
		// const worksheet = XLSX.utils.aoa_to_sheet([
		// 	['Header 1', 'Header 2', 'Header 3'],
		// 	['Data 1', 'Data 2', 'Data 3']
		// ]);

		// // Merge cells programmatically
		// worksheet['!merges'] = [
		// 	{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } } // Merge Header 1-3 into a single cell
		// ];

		// // Add additional data
		// XLSX.utils.sheet_add_aoa(worksheet, [['Additional Row']], { origin: { r: 3, c: 0 } });

		// // Create a workbook and append the worksheet
		// const workbook = XLSX.utils.book_new();

		// XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		// // Write the workbook and trigger download
		// const blob = new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
		// 	type: 'application/octet-stream'
		// });
		// const url = URL.createObjectURL(blob);

		// // Create a link and download the file
		// const link = document.createElement('a');
		// link.href = url;
		// link.download = 'ExportedData.xlsx';
		// document.body.appendChild(link);
		// link.click();
		// document.body.removeChild(link);

		// // Free resources
		// URL.revokeObjectURL(url);
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
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					<Button variant="outline" size="sm" onclick={handleNew}>
						<FilePlus class="h-4 w-4" />
					</Button>
				</Tooltip.Trigger>
				<Tooltip.Content>New document</Tooltip.Content>
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
	<Button onclick={exportToExcel} variant="outline" size="sm">
		<FileUp class="h-4 w-4" />
		Export to Excel
	</Button>
</div>
