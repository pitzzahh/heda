<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { goto } from '$app/navigation';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { GenericPhaseMainPanelForm } from '@/components/custom/panel';
	import { Separator } from '@/components/ui/separator/index.js';

	let {
		children,
		id,
		generic_phase_panel_form
	}: {
		children: Snippet;
		id: string;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
	} = $props();

	let open_panel_dialog = $state(false); // Add a reactive variable to control the dialog state
	let clickTimeout: number | null = null; // To store the timeout for single-click

	function handleClick() {
		if (clickTimeout) {
			clearTimeout(clickTimeout);
			clickTimeout = null;
			open_panel_dialog = true;
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

<Dialog.Root bind:open={open_panel_dialog}>
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Add a Panel</Dialog.Title>
			<div class="flex flex-col items-center justify-start">
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Name:</h4>
							<p>SAMPLE MAIN NAME</p>
						</div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Ambient temperature:</h4>
							<p>SAMPLE MAIN AMBIENT TEMP</p>
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Wire Length:</h4>
							<p>SAMPLE MAIN Wire Length</p>
						</div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Phase:</h4>
							<p>SAMPLE MAIN PHASE</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<Separator class="my-1" />
		<GenericPhaseMainPanelForm
			{generic_phase_panel_form}
			main_phase="ONE_PHASE"
			bind:open_panel_dialog
		/>
	</Dialog.Content>
</Dialog.Root>
