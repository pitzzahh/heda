<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Panel } from '@/types/panel';
	import { getProjectState } from '@/hooks/project.svelte';
	import { goto } from '$app/navigation';
	import type { GenericPhasePanelSchema } from '@/schema/panel';

	let {
		children,
		id,
		generic_phase_panel_form
	}: { children: any; id: string; generic_phase_panel_form: GenericPhasePanelSchema } =
		$props();
	let panelName = $state('');
	let isDialogOpen = $state(false); // Add a reactive variable to control the dialog state
	let projectState = getProjectState();
	let clickTimeout: number | null = null; // To store the timeout for single-click

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

		isDialogOpen = false;
		panelName = '';
	}

	function handleClick() {
		if (clickTimeout) {
			clearTimeout(clickTimeout);
			clickTimeout = null;
			isDialogOpen = true;
		} else {
			// @ts-ignore
			clickTimeout = setTimeout(() => {
				clickTimeout = null;
				goto(`/workspace/load-schedule/${id}`);
			}, 300);
		}
	}
</script>

<button class="flex items-center gap-2" onclick={handleClick}>
	{@render children?.()}
</button>

<Dialog.Root bind:open={isDialogOpen}>
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
