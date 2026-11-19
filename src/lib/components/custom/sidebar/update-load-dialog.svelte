<script lang="ts" module>
	import type { Node } from '#lib/types/db.js';

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
	import { GenericPhaseMainLoadForm } from '#lib/components/custom/load/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { DEFAULT_PHASES } from '#lib/constants.js';
	import { getOptionLabel } from '#lib/utils/format.js';
	import ParentPanelPopover from '../parent-panel-popover.svelte';

	let {
		open_load_dialog = $bindable(false),
		some_open_state = $bindable(),
		remove_trigger = false,
		load_to_edit,
		highest_unit
	}: Props = $props();

	const phase = $derived(highest_unit.phase);

	const parent_node = $derived(
		load_to_edit.parent_id ? getNode(load_to_edit.parent_id) : undefined
	);
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

<Dialog.Root bind:open={open_load_dialog} onOpenChange={(o) => (some_open_state = o === true)}>
	{#if !remove_trigger}
		<Dialog.Trigger class={buttonVariants({ variant: 'ghost', size: 'sm' })}
			>Update Load</Dialog.Trigger
		>
	{/if}
	<Dialog.Content class="w-full max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update Load</Dialog.Title>
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
									current_parent_id={load_to_edit.parent_id || ''}
									selected_parent={parent_display}
									onselect={(parent) => (selected_parent = parent)}
									excluded_node_id={load_to_edit.id}
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
		<svelte:boundary>
			<GenericPhaseMainLoadForm
				selected_parent_id={parent_display?.id}
				closeDialog={() => (open_load_dialog = false)}
				node_to_edit={load_to_edit}
				action="edit"
			/>
			{#snippet failed(error, reset)}
				<p class="text-sm text-muted-foreground">{error}</p>
				<Button onclick={reset}>oops! try again</Button>
			{/snippet}
		</svelte:boundary>
		<Dialog.Close />
	</Dialog.Content>
</Dialog.Root>
