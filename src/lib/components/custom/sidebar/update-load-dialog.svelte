<script lang="ts">
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { GenericPhaseMainLoadForm } from '@/components/custom/load';
	import { Separator } from '@/components/ui/separator/index.js';
	import type { Node } from '@/db/schema';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';
	import { getNodeById } from '@/db/queries';
	import ParentPanelPopover from '../parent-panel-popover.svelte';
	import { cn } from '@/utils';

	let {
		phase_main_load_form,
		open_load_dialog = $bindable(false),
		some_open_state = $bindable(),
		remove_trigger = false,
		load_to_edit,
		highest_unit
	}: {
		phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>;
		some_open_state?: boolean;
		open_load_dialog?: boolean;
		remove_trigger?: boolean;
		load_to_edit: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
	} = $props();

	const { phase } = highest_unit;

	let selected_parent = $state<{ name: string; id: string } | null>(null);

	$effect(() => {
		if (load_to_edit.parent_id) {
			getNodeById(load_to_edit.parent_id).then((node) => {
				selected_parent = {
					name: node?.highest_unit_form?.distribution_unit || node?.panel_data?.name || '',
					id: node?.id || ''
				};
			});
		}
	});
</script>

<Dialog.Root bind:open={open_load_dialog} onOpenChange={(o) => (some_open_state = o === true)}>
	{#if !remove_trigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}
			>Update Load</Dialog.Trigger
		>
	{/if}
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update Load</Dialog.Title>
			<div class={cn('flex flex-col items-center justify-start')}>
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex items-center gap-1">
							<h4 class="font-semibold">Supply From:</h4>
							{#if selected_parent}
								<ParentPanelPopover
									current_parent_id={load_to_edit.parent_id || ''}
									bind:selected_parent
									excluded_node_id={load_to_edit.id}
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
			<GenericPhaseMainLoadForm
				{phase_main_load_form}
				selected_parent_id={selected_parent?.id}
				closeDialog={() => (open_load_dialog = false)}
				node_to_edit={load_to_edit}
				action="edit"
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
	</Dialog.Content>
</Dialog.Root>
