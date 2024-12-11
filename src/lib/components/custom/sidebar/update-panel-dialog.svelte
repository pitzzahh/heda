<script lang="ts">
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { GenericPhaseMainPanelForm } from '@/components/custom/panel';
	import { Separator } from '@/components/ui/separator/index.js';
	import type { Phase } from '@/types/phase';
	import { cn } from '@/utils';
	import type { HighestUnitSchema } from '@/schema';
	import type { Node } from '@/types/project';

	let {
		generic_phase_panel_form,
		parent_id,
		highest_unit,
		panel_to_edit
	}: {
		highest_unit: HighestUnitSchema;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
		parent_id: string;
		panel_to_edit: Node;
	} = $props();

	const { phase } = highest_unit;

	let open_panel_dialog = $state(false); // Add a reactive variable to control the dialog state
</script>

<Dialog.Root bind:open={open_panel_dialog}>
	<Dialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>Update</Dialog.Trigger>
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update a Panel</Dialog.Title>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<svelte:boundary>
			<GenericPhaseMainPanelForm
				action="edit"
				{parent_id}
				{generic_phase_panel_form}
				main_phase={phase as Phase}
				closeDialog={() => (open_panel_dialog = false)}
				{panel_to_edit}
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
	</Dialog.Content>
</Dialog.Root>
