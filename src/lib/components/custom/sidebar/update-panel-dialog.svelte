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
			<div class="grid gap-1.5 pt-1">
				<span class="text-[9px] font-semibold tracking-[0.24em] text-muted-foreground uppercase"
					>Main</span
				>
				<dl
					class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 text-sm sm:grid-cols-2 sm:gap-x-4"
				>
					<div class="grid min-w-0 gap-0.5">
						<dt class="text-xs text-muted-foreground">Supply from</dt>
						<dd class="min-w-0 font-medium [&>p]:truncate">
							{#if parent_display}
								<ParentPanelPopover
									current_parent_id={panel_to_edit.parent_id || ''}
									selected_parent={parent_display}
									onselect={(parent) => (selected_parent = parent)}
									excluded_node_id={panel_to_edit.id}
								/>
							{/if}
						</dd>
					</div>
					<div class="grid gap-0.5">
						<dt class="text-xs text-muted-foreground">Phase</dt>
						<dd class="font-medium">{getOptionLabel(DEFAULT_PHASES, phase) || 'N/A'}</dd>
					</div>
				</dl>
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
