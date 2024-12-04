<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { getProjectState } from '@/hooks/project.svelte';
	import { goto } from '$app/navigation';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { GenericPhaseMainPanelForm } from '@/components/custom/panel';

	let {
		children,
		id,
		generic_phase_panel_form
	}: {
		children: any;
		id: string;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
	} = $props();
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

<button class="flex w-full items-center gap-2" onclick={handleClick}>
	{@render children?.()}
</button>

<Dialog.Root bind:open={isDialogOpen}>
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Add a Panel</Dialog.Title>
			<div class="flex flex-col items-center justify-start">
				<h3 class="scroll-m-20 text-2xl font-semibold tracking-tight">MAIN</h3>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex gap-1">
							<h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Name:</h4>
							<p class="leading-7">SAMPLE MAIN NAME</p>
						</div>
						<div class="flex gap-1">
							<h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Ambient temperature:</h4>
							<p class="leading-7">SAMPLE MAIN AMBIENT TEMP</p>
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Wire Length:</h4>
							<p class="leading-7">SAMPLE MAIN Wire Length</p>
						</div>
						<div class="flex gap-1">
							<h4 class="scroll-m-20 text-xl font-semibold tracking-tight">Phase:</h4>
							<p class="leading-7">SAMPLE MAIN PHASE</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<GenericPhaseMainPanelForm {generic_phase_panel_form} main_phase="ONE_PHASE" />
	</Dialog.Content>
</Dialog.Root>
