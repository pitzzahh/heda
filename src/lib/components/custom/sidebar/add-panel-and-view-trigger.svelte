<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { goto } from '$app/navigation';
	import { Button } from '@/components/ui/button/index.js';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { GenericPhaseMainPanelForm } from '@/components/custom/panel';
	import { Separator } from '@/components/ui/separator/index.js';
	import type { Phase } from '@/types/phase';
	import { cn } from '@/utils';
	import type { Node } from '@/db/schema';
	import { getNodeById } from '@/db/queries';
	import { getProjectState } from '@/hooks/project-state.svelte';

	let {
		children,
		id,
		generic_phase_panel_form,
		parent_id,
		highest_unit,
		panel_name,
		open_dialog_state = $bindable(false),
		latest_circuit_node
	}: {
		children?: Snippet;
		id: string;
		panel_name: string;
		highest_unit: NonNullable<Node['highest_unit_form']>;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
		parent_id: string;
		open_dialog_state?: boolean;
		latest_circuit_node?: Node;
	} = $props();

	const { phase } = highest_unit;

	const project_state = getProjectState();

	let clickTimeout: number | null = null; // To store the timeout for single-click

	function handleClick() {
		// if (clickTimeout) {
		// 	clearTimeout(clickTimeout);
		// 	clickTimeout = null;
		// 	open_dialog_state = true;
		// } else {
		// @ts-ignore
		clickTimeout = setTimeout(() => {
			clickTimeout = null;
			goto(`/workspace/load-schedule/${panel_name + '_' + id}`);
		}, 300);
		// }
	}
</script>

<button class="flex w-full items-center gap-2" onclick={handleClick}>
	{@render children?.()}
</button>

<Dialog.Root bind:open={open_dialog_state}>
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Add a Panel</Dialog.Title>
			<div class="flex flex-col items-center justify-start">
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Supply From:</h4>
							{#await getNodeById(parent_id, project_state.current_project_name)}
								<p></p>
							{:then parent_node}
								<p>
									{parent_node?.highest_unit_form?.distribution_unit ||
										parent_node?.panel_data?.name ||
										'N/A'}
								</p>
							{/await}
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Phase:</h4>
							<p>{highest_unit.phase ?? 'N/A'}</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<svelte:boundary>
			<GenericPhaseMainPanelForm
				action="add"
				{parent_id}
				{generic_phase_panel_form}
				main_phase={phase as Phase}
				closeDialog={() => (open_dialog_state = false)}
				{latest_circuit_node}
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>Something went horribly wrong. Click to FIX me</Button>
			{/snippet}
		</svelte:boundary>
	</Dialog.Content>
</Dialog.Root>
