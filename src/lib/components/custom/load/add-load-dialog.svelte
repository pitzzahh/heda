<script lang="ts" module>
	import { PlusCircleIcon } from '#lib/assets/icons.js';
	import type { Node } from '#lib/types/db.js';

	interface Props {
		highest_unit?: NonNullable<Node['highest_unit_form']>;
		latest_circuit_node?: Node;
		open_dialog_state?: boolean;
		remove_trigger?: boolean;
		panel_id_from_tree?: string;
	}
</script>

<script lang="ts">
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { GenericPhaseMainLoadForm } from '#lib/components/custom/load/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { DEFAULT_PHASES } from '#lib/constants.js';
	import { getOptionLabel } from '#lib/utils/format.js';
	import { nodeIdFromRouteId } from '#lib/helpers/navigation.js';
	import { page } from '$app/state';

	let {
		open_dialog_state = $bindable(false),
		remove_trigger = false,
		highest_unit,
		latest_circuit_node,
		panel_id_from_tree
	}: Props = $props();

	const parent_id = $derived(panel_id_from_tree || nodeIdFromRouteId(page.params.id) || '');
	const parent_node = $derived(parent_id ? getNode(parent_id) : undefined);
</script>

<div class="flex flex-col gap-2">
	<Dialog.Root bind:open={open_dialog_state}>
		{#if !remove_trigger}
			<Dialog.Trigger
				class={buttonVariants({
					variant: 'outline',
					className: 'h-6 w-full bg-primary text-primary-foreground hover:bg-primary/90'
				})}
			>
				<PlusCircleIcon class="size-4" />
			</Dialog.Trigger>
		{/if}

		<Dialog.Content class="w-full max-w-[85%]">
			<Dialog.Header>
				<Dialog.Title>Add load</Dialog.Title>
				<Dialog.Description>Enter the load details.</Dialog.Description>
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
								{#if parent_node?.highest_unit_form?.distribution_unit}
									<p>{parent_node.highest_unit_form.distribution_unit}</p>
								{:else if parent_node?.panel_data?.name}
									<p>{parent_node.panel_data.name}</p>
								{:else}
									<p>N/A</p>
								{/if}
							</dd>
						</div>
						<div class="grid gap-0.5">
							<dt class="text-xs text-muted-foreground">Phase</dt>
							<dd class="font-medium">
								{getOptionLabel(DEFAULT_PHASES, highest_unit?.phase) || 'N/A'}
							</dd>
						</div>
					</dl>
				</div>
			</Dialog.Header>
			<GenericPhaseMainLoadForm
				action="add"
				closeDialog={() => (open_dialog_state = false)}
				{latest_circuit_node}
				{panel_id_from_tree}
			/>
			<Dialog.Close />
		</Dialog.Content>
	</Dialog.Root>
</div>
