<script lang="ts" module>
	import type { Node } from '#lib/types/db.js';

	interface Props {
		highest_unit: NonNullable<Node['highest_unit_form']>;
		parent_id: string;
		open_panel_dialog?: boolean;
		some_open_state?: boolean;
		trigger_text?: string;
		show_trigger?: boolean;
		panel_to_edit: Node;
	}
</script>

<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { GenericPhaseMainPanelForm } from '#lib/components/custom/panel/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import type { Phase } from '#lib/types/phase.js';
	import { supplyPhaseOf } from '#lib/utils/computations/index.js';
	import { cn } from '#lib/utils/index.js';
	import ParentPanelPopover from '../parent-panel-popover.svelte';
	import { getNode } from '#lib/db/queries/index.js';
	import { DEFAULT_PHASES } from '#lib/constants.js';
	import { getOptionLabel } from '#lib/utils/format.js';

	let {
		parent_id,
		highest_unit,
		open_panel_dialog = $bindable(false),
		some_open_state = $bindable(),
		trigger_text = 'Update Panel',
		show_trigger = false,
		panel_to_edit
	}: Props = $props();

	const parent_node = $derived(
		panel_to_edit.parent_id ? getNode(panel_to_edit.parent_id) : undefined
	);
	// What the parent feeds: the project's supply at the root, else the parent panel's phase.
	const phase = $derived(supplyPhaseOf(parent_node) ?? highest_unit.phase);
	let selected_parent = $state<{ name: string; id: string } | null>(null);
	const parent_display = $derived(
		selected_parent ??
			(parent_node
				? {
						name:
							parent_node.highest_unit_form?.distribution_unit ||
							parent_node.panel_data?.name ||
							'',
						id: parent_node.id
					}
				: null)
	);
</script>

<Dialog.Root bind:open={open_panel_dialog} onOpenChange={(o) => (some_open_state = o === true)}>
	{#if show_trigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}
			>{trigger_text}</Dialog.Trigger
		>
	{/if}
	<Dialog.Content class="w-full max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update a Panel</Dialog.Title>
			<div class={cn('flex flex-col items-center justify-start')}>
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex items-center gap-1">
							<h4 class="font-semibold">Supply From:</h4>
							{#if parent_display}
								<ParentPanelPopover
									current_parent_id={panel_to_edit.parent_id || ''}
									selected_parent={parent_display}
									onselect={(parent) => (selected_parent = parent)}
									excluded_node_id={panel_to_edit.id}
								/>
							{/if}
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Phase:</h4>
							<p>
								{getOptionLabel(DEFAULT_PHASES, phase) || 'N/A'}
							</p>
						</div>
					</div>
				</div>
			</div>
		</Dialog.Header>
		<Separator class="mb-4" />
		<svelte:boundary>
			<GenericPhaseMainPanelForm
				action="edit"
				{parent_id}
				main_phase={phase as Phase}
				selected_parent_id={parent_display?.id}
				closeDialog={() => (open_panel_dialog = false)}
				node_to_edit={panel_to_edit}
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>
