<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { LocalStorage } from '@/hooks/storage.svelte';

	let { children } = $props();
	let panelName = $state('');
	let isDialogOpen = $state(false); // Add a reactive variable to control the dialog state
	let localStorage = new LocalStorage<{
		highest_unit_form: any;
		panels: { panel_name: string; loads: { description: string }[] }[];
	}>('project');

	function handleSubmit() {
		const newProjectData = {
			...localStorage.current,
			panels: [
				...localStorage.current.panels,
				{ panel_name: panelName, loads: [{ description: panelName + ' load' }] }
			]
		};
		localStorage.current = newProjectData;
		// Close the dialog after submission
		isDialogOpen = false;
		panelName = ''; // Reset the input field
	}
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger>
		{@render children?.()}
	</ContextMenu.Trigger>
	<ContextMenu.Content class="w-64">
		<Dialog.Root bind:open={isDialogOpen}>
			<Dialog.Trigger class="w-full">
				<ContextMenu.Item inset>Add Panel</ContextMenu.Item>
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-[425px]">
				<Dialog.Header>
					<Dialog.Title>Add a Panel</Dialog.Title>
				</Dialog.Header>
				<div class="grid gap-2">
					<Label for="name" class="text-left">Name</Label>
					<Input id="name" bind:value={panelName} />
				</div>
				<Dialog.Footer>
					<Button type="submit" class="w-full" onclick={handleSubmit}>Add</Button>
				</Dialog.Footer>
			</Dialog.Content>
		</Dialog.Root>

		<ContextMenu.Item inset>View Details</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
