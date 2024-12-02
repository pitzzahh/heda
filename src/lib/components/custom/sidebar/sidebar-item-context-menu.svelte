<script lang="ts">
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { LocalStorage } from '@/hooks/storage.svelte';
	import type { Panel } from '@/types/panel';
	import { goto } from '$app/navigation';
	import { getProjectState } from '@/hooks/project.svelte';

	interface ProjectProps {
		highest_unit_form: any;
		tree: Panel[];
	}

	let { children, uri }: { children: any; uri: string } = $props();
	let panelName = $state('');
	let isDialogOpen = $state(false); // Add a reactive variable to control the dialog state
	let context_menu_open = $state(false); // Add a reactive variable to control the dialog state
	let localStorage = new LocalStorage<ProjectProps>('project');
	let projectState = getProjectState();

	function handleSubmit() {
		// should normally work because its a signal
		projectState.addPanel({
			id: Math.floor(Math.random() * 100) + 1,
			name: panelName,
			loads: [
				{
					id: (Math.floor(Math.random() * 100) + 1).toString(),
					load_description: 'Lighting Circuit',
					quantity: 10,
					varies: 0,
					is_panel: 1,
					continuous: 1,
					special: 'Main hallway lights'
				},
				{
					id: (Math.floor(Math.random() * 100) + 1).toString(),
					load_description: 'Power Circuit',
					quantity: 5,
					varies: 1,
					is_panel: 0,
					continuous: 0,
					special: 'Office power outlets'
				},
				{
					id: (Math.floor(Math.random() * 100) + 1).toString(),
					load_description: 'HVAC Circuit',
					quantity: 2,
					varies: 0,
					is_panel: 1,
					continuous: 1,
					special: 'Main HVAC system'
				}
			]
		});

		// localStorage.current.tree.push();
		// Close the dialog after submission
		context_menu_open = false;
		isDialogOpen = false;
		panelName = ''; // Reset the input field
	}
</script>

<ContextMenu.Root bind:open={context_menu_open}>
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

		<ContextMenu.Item inset onclick={() => goto(uri)}>View Details</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
