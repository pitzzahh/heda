<script lang="ts">
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { GenericPhaseMainLoadForm } from '@/components/custom/load';
	import { Separator } from '@/components/ui/separator/index.js';
	import type { Phase } from '@/types/phase';
	import { cn } from '@/utils';
	import type { HighestUnitSchema } from '@/schema';
	import type { Node } from '@/types/project';
	import type { PhaseMainLoadSchema } from '@/schema/load';

	let {
		node_id,
		phase_main_load_form,
		some_open_state = $bindable(),
		load_to_edit
	}: {
		node_id: string;
		phase_main_load_form: SuperValidated<PhaseMainLoadSchema>;
		some_open_state?: boolean;
		load_to_edit: Node;
	} = $props();

	let open_panel_dialog = $state(false); // Add a reactive variable to control the dialog state
</script>

<Dialog.Root bind:open={open_panel_dialog} onOpenChange={(o) => (some_open_state = o === true)}>
	<Dialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}>Update</Dialog.Trigger>
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update Load</Dialog.Title>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<svelte:boundary>
			<GenericPhaseMainLoadForm
				{phase_main_load_form}
				closeDialog={() => (open_panel_dialog = false)}
				{load_to_edit}
				action="edit"
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
	</Dialog.Content>
</Dialog.Root>
