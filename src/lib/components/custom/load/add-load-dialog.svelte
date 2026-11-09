<script lang="ts" module>
	import { PlusCircleIcon } from '#lib/assets/icons/index.js';
	import type { Node } from '#lib/types/db/index.js';

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
	import Separator from '#lib/components/ui/separator/separator.svelte';
	import { getNode } from '#lib/db/queries/index.js';
	import { DEFAULT_PHASES } from '#lib/constants/index.js';
	import { getOptionLabel } from '#lib/utils/format/index.js';
	import { page } from '$app/state';

	let {
		open_dialog_state = $bindable(false),
		remove_trigger = false,
		highest_unit,
		latest_circuit_node,
		panel_id_from_tree
	}: Props = $props();

	const parent_id = $derived(panel_id_from_tree || page.params.id?.split('_').at(-1) || '');
	const parent_node = $derived(parent_id ? getNode(parent_id) : undefined);
</script>

<div class="flex flex-col gap-2">
	<Dialog.Root bind:open={open_dialog_state}>
		{#if !remove_trigger}
			<Dialog.Trigger
				class={buttonVariants({
					variant: 'outline',
					className: 'bg-primary text-primary-foreground hover:bg-primary/90 h-6 w-full'
				})}
			>
				<PlusCircleIcon class="size-4" />
			</Dialog.Trigger>
		{/if}

		<Dialog.Content class="w-full max-w-[85%]">
			<Dialog.Header>
				<Dialog.Title>Add load</Dialog.Title>
				<Dialog.Description>Enter the load details.</Dialog.Description>
				<div class="flex flex-col gap-1">
					<h4 class="text-center font-bold">MAIN</h4>
					<div class="grid w-full grid-cols-2 gap-4">
						<div>
							<div class="flex items-center gap-1">
								<h4 class="font-semibold">Supply From:</h4>
								{#if parent_node?.highest_unit_form?.distribution_unit}
									<p>{parent_node.highest_unit_form.distribution_unit}</p>
								{:else if parent_node?.panel_data?.name}
									<p>{parent_node.panel_data.name}</p>
								{:else}
									<p>N/A</p>
								{/if}
							</div>
						</div>
						<div>
							<div class="flex items-center gap-1">
								<h4 class="font-semibold">Phase:</h4>
								<p>
									{getOptionLabel(DEFAULT_PHASES, highest_unit?.phase) || 'N/A'}
								</p>
							</div>
						</div>
					</div>
				</div>
			</Dialog.Header>
			<Separator class="mt-0.5" />
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
