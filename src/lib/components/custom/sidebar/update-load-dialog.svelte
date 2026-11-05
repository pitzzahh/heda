<script lang="ts" module>
	import type { Node } from '#lib/types/db';

	interface Props {
		some_open_state?: boolean;
		open_load_dialog?: boolean;
		remove_trigger?: boolean;
		load_to_edit: Node;
		highest_unit: NonNullable<Node['highest_unit_form']>;
	}
</script>

<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { GenericPhaseMainLoadForm } from '#lib/components/custom/load';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { getNodeById } from '#lib/db/queries';
	import ParentPanelPopover from '../parent-panel-popover.svelte';
	import { cn } from '#lib/utils';

	let {
		open_load_dialog = $bindable(false),
		some_open_state = $bindable(),
		remove_trigger = false,
		load_to_edit,
		highest_unit
	}: Props = $props();

	const phase = $derived(highest_unit.phase);

	let selected_parent = $state<{ name: string; id: string } | null>(null);

	// Loads the parent name for display whenever the edited load changes.
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
	<Dialog.Content class="w-full max-w-[70%]">
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
							<p>
								{#if phase == null}
									N/A
								{:else}
									{phase}
								{/if}
							</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<svelte:boundary>
			<GenericPhaseMainLoadForm
				selected_parent_id={selected_parent?.id}
				closeDialog={() => (open_load_dialog = false)}
				node_to_edit={load_to_edit}
				action="edit"
			/>
			{#snippet failed(error, reset)}
				<p class="text-muted-foreground text-sm">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>
