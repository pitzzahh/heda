<script lang="ts">
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { GenericPhaseMainLoadForm } from '@/components/custom/load';
	import { CirclePlus } from '@/assets/icons';
	import type { SuperValidated } from 'sveltekit-superforms';
	import { type GenericPhaseMainLoadSchema } from '@/schema/load';
	import type { Node } from '@/db/schema';
	import { cn } from '@/utils';
	import Separator from '@/components/ui/separator/separator.svelte';
	import { getNodeById } from '@/db/queries';
	import { page } from '$app/state';

	interface Props {
		phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>;
		highest_unit?: NonNullable<Node['highest_unit_form']>;
		latest_circuit_node?: Node;
		open_dialog_state?: boolean;
		remove_trigger?: boolean;
		panel_id_from_tree?: string;
	}

	let {
		phase_main_load_form,
		open_dialog_state = $bindable(false),
		remove_trigger = false,
		highest_unit,
		latest_circuit_node,
		panel_id_from_tree,
		...props
	}: Props = $props();
</script>

<div class="flex flex-col gap-2">
	{#if !remove_trigger}
		CRKT NO.
	{/if}
	<Dialog.Root {...props} bind:open={open_dialog_state}>
		{#if !remove_trigger}
			<Dialog.Trigger
				class={buttonVariants({
					variant: 'outline',
					className: 'h-6 w-full bg-primary text-white hover:bg-primary/80 hover:text-white'
				})}
			>
				<CirclePlus class="size-4" />
			</Dialog.Trigger>
		{/if}

		<Dialog.Content class="max-w-[85%]">
			<Dialog.Header>
				<Dialog.Title>Add load</Dialog.Title>
				<Dialog.Description>Enter the load details.</Dialog.Description>
				<div class={cn('flex flex-col items-center justify-start')}>
					<h4 class="mb-1 font-bold">MAIN</h4>
					<div class="grid w-full grid-cols-2 justify-items-start">
						<div>
							<div class="flex gap-1">
								<h4 class="font-semibold">Supply From:</h4>
								{#await getNodeById(panel_id_from_tree || page.params.id
											.split('_')
											.at(-1) || '') then parent_node}
									<p>
										{parent_node?.highest_unit_form?.distribution_unit ||
											parent_node?.panel_data?.name ||
											'N/A'}
									</p>
								{/await}
							</div>
						</div>
						<div>
							<div class="flex gap-1">
								<h4 class="font-semibold">Phase:</h4>
								<p>{highest_unit?.phase ?? 'N/A'}</p>
							</div>
						</div>
					</div>
				</div>
			</Dialog.Header>
			<Separator class="mt-0.5" />
			<GenericPhaseMainLoadForm
				action={'add'}
				closeDialog={() => (open_dialog_state = false)}
				{phase_main_load_form}
				{latest_circuit_node}
				{panel_id_from_tree}
			/>
		</Dialog.Content>
	</Dialog.Root>
</div>
