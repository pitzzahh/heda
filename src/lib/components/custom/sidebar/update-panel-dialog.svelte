<script lang="ts">
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import type { GenericPhasePanelSchema } from '@/schema/panel';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { GenericPhaseMainPanelForm } from '@/components/custom/panel';
	import { Separator } from '@/components/ui/separator/index.js';
	import type { Phase } from '@/types/phase';
	import { cn } from '@/utils';
	import type { Node } from '@/db/schema';
	import ParentPanelPopover from '../parent-panel-popover.svelte';
	import { getNodeById } from '@/db/queries';

	let {
		generic_phase_panel_form,
		parent_id,
		highest_unit,
		open_panel_dialog = $bindable(false),
		some_open_state = $bindable(),
		trigger_text = 'Update Panel',
		show_trigger = false,
		panel_to_edit
	}: {
		highest_unit: NonNullable<Node['highest_unit_form']>;
		generic_phase_panel_form: SuperValidated<GenericPhasePanelSchema>;
		parent_id: string;
		open_panel_dialog?: boolean;
		some_open_state?: boolean;
		trigger_text?: string;
		show_trigger?: boolean;
		panel_to_edit: Node;
	} = $props();

	const { phase } = highest_unit;

	let selected_parent = $state<{ name: string; id: string } | null>(null);

	$effect(() => {
		if (panel_to_edit.parent_id) {
			getNodeById(panel_to_edit.parent_id).then((node) => {
				selected_parent = {
					name: node?.highest_unit_form?.distribution_unit || node?.panel_data?.name || '',
					id: node?.id || ''
				};
			});
		}
	});
</script>

<Dialog.Root bind:open={open_panel_dialog} onOpenChange={(o) => (some_open_state = o === true)}>
	{#if show_trigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}
			>{trigger_text}</Dialog.Trigger
		>
	{/if}
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update a Panel</Dialog.Title>
			<div class={cn('flex flex-col items-center justify-start')}>
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex items-center gap-1">
							<h4 class="font-semibold">Supply From:</h4>
							{#if selected_parent}
								<ParentPanelPopover
									current_parent_id={panel_to_edit.parent_id || ''}
									bind:selected_parent
									excluded_node_id={panel_to_edit.id}
								/>
							{/if}
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Phase:</h4>
							<p>{phase ?? 'N/A'}</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<svelte:boundary>
			<GenericPhaseMainPanelForm
				action="edit"
				{parent_id}
				{generic_phase_panel_form}
				main_phase={phase as Phase}
				selected_parent_id={selected_parent?.id}
				closeDialog={() => (open_panel_dialog = false)}
				node_to_edit={panel_to_edit}
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
	</Dialog.Content>
</Dialog.Root>
