<script lang="ts" module>
	import { PlusCircleIcon } from '#lib/assets/icons';
	import type { Node } from '#lib/types/db';

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
	import { GenericPhaseMainLoadForm } from '#lib/components/custom/load';
	import { cn } from '#lib/utils';
	import Separator from '#lib/components/ui/separator/separator.svelte';
	import { getNodeById } from '#lib/db/queries';
	import { page } from '$app/state';

	let {
		open_dialog_state = $bindable(false),
		remove_trigger = false,
		highest_unit,
		latest_circuit_node,
		panel_id_from_tree
	}: Props = $props();
</script>

<div class="flex flex-col gap-2">
	{#if !remove_trigger}
		CRKT NO.
	{/if}
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
				<div class={cn('flex flex-col items-center justify-start')}>
					<h4 class="mb-1 font-bold">MAIN</h4>
					<div class="grid w-full grid-cols-2 justify-items-start">
						<div>
							<div class="flex gap-1">
								<h4 class="font-semibold">Supply From:</h4>
								{#await getNodeById(panel_id_from_tree || page.params
											.id!.split('_')
											.at(-1) || '') then parent_node}
									<p>
										{#if parent_node?.highest_unit_form?.distribution_unit}
											{parent_node.highest_unit_form.distribution_unit}
										{:else if parent_node?.panel_data?.name}
											{parent_node.panel_data.name}
										{:else}
											N/A
										{/if}
									</p>
								{/await}
							</div>
						</div>
						<div>
							<div class="flex gap-1">
								<h4 class="font-semibold">Phase:</h4>
								<p>
									{#if highest_unit?.phase == null}
										N/A
									{:else}
										{highest_unit?.phase}
									{/if}
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
