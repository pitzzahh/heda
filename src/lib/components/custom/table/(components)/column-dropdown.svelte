<script lang="ts">
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Button } from '@/components/ui/button';
	import { Ellipsis, Pencil, Trash2, Copy } from '@/assets/icons';
	import { copyAndAddNodeById, removeNode } from '@/db/mutations';
	import { invalidateAll } from '$app/navigation';
	import GenericPhaseMainLoadForm from '@/components/custom/load/generic-phase-main-load-form.svelte';
	import type { Node } from '@/db/schema';
	import { ConfirmationDialog } from '@/components/custom';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';
	import { getNodeById } from '@/db/queries';
	import ParentPanelPopover from '../../parent-panel-popover.svelte';
	import { cn } from '@/utils';
	import Separator from '@/components/ui/separator/separator.svelte';
	import { toast } from 'svelte-sonner';
	import { RefreshCcw } from 'lucide-svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import StandardAmpereRatingsSelector from '../../standard_ampere-ratings-selector.svelte';
	import { overrideLoadAmpereTrip } from '@/db/mutations';

	let {
		node,
		phase_main_load_form,
		highest_unit,
		...props
	}: {
		node: PhaseLoadSchedule;
		phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema>;
		highest_unit?: NonNullable<Node['highest_unit_form']>;
	} = $props();
	const phase = highest_unit?.phase;

	let is_update_dialog_open = $state(false);
	let is_override_at_dialog_open = $state(false);
	let open_dropdown_menu = $state(false);
	let selected_parent = $state<{ name: string; id: string } | null>(null);

	$effect(() => {
		if (node.parent_id) {
			getNodeById(node.parent_id).then((node) => {
				selected_parent = {
					name: node?.highest_unit_form?.distribution_unit || node?.panel_data?.name || '',
					id: node?.id || ''
				};
			});
		}
	});

	async function handleRemoveLoad() {
		await removeNode(node.id);
		await invalidateAll();
		toast.success(`Load ${node.load_data?.load_description ?? 'Unknown'} removed successfully.`);
	}
</script>

<div class="grid w-full place-content-center">
	<DropdownMenu.Root bind:open={open_dropdown_menu}>
		<DropdownMenu.Trigger>
			<Button size="icon" variant="outline">
				<Ellipsis class="size-4" />
			</Button>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>Actions</DropdownMenu.GroupHeading>
				<DropdownMenu.Separator />

				{#if node.node_type === 'load'}
					<DropdownMenu.Item onclick={() => (is_update_dialog_open = true)}>
						<Pencil class="ml-2 size-4" />
						Update
					</DropdownMenu.Item>
					<DropdownMenu.Item
						onclick={async () => {
							await copyAndAddNodeById(node.id);
							await invalidateAll();
						}}
					>
						<Copy class="ml-2 size-4" />
						Copy
					</DropdownMenu.Item>
				{/if}

				<DropdownMenu.Item onclick={() => (is_override_at_dialog_open = true)}>
					<RefreshCcw class="ml-2 size-4" />
					Override AT
				</DropdownMenu.Item>

				{#if !!node.overrided_at}
					<DropdownMenu.Item
						class="!text-red-500 hover:!bg-red-500/20"
						onclick={async () => {
							await overrideLoadAmpereTrip({ node_id: node.id, unoverride: true });
							await invalidateAll();
						}}
					>
						<RefreshCcw class="ml-2 size-4" />
						Remove Overrided AT
					</DropdownMenu.Item>
				{/if}

				{#if node.node_type === 'load'}
					<DropdownMenu.Item class="mt-0.5 p-0">
						{#snippet children()}
							<ConfirmationDialog
								show_trigger={true}
								trigger_text="Remove load"
								trigger_variant="destructive"
								bind:some_open_state={open_dropdown_menu}
								onConfirm={handleRemoveLoad}
							/>
						{/snippet}
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<Dialog.Root {...props} bind:open={is_update_dialog_open}>
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update load</Dialog.Title>
			<Dialog.Description>Edit the load details.</Dialog.Description>
			<div class={cn('flex flex-col items-center justify-start')}>
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex items-center gap-1">
							<h4 class="font-semibold">Supply From:</h4>
							<!-- <p>{distribution_unit ?? 'N/A'}</p> -->
							{#if selected_parent}
								<ParentPanelPopover
									current_parent_id={node.parent_id || ''}
									bind:selected_parent
									excluded_node_id={node.id}
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
		<GenericPhaseMainLoadForm
			action={'edit'}
			selected_parent_id={selected_parent?.id}
			closeDialog={() => (is_update_dialog_open = false)}
			{phase_main_load_form}
			node_to_edit={node}
		/>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root {...props} bind:open={is_override_at_dialog_open}>
	<Dialog.Content class="max-w-[350px]">
		<Dialog.Header>
			<Dialog.Title>Override AT</Dialog.Title>
			<Dialog.Description>
				Override the AT of <span class="font-semibold">{node.load_description}</span>
			</Dialog.Description>
		</Dialog.Header>
		<Separator class="mt-0.5" />
		<StandardAmpereRatingsSelector
			closeDialog={() => (is_override_at_dialog_open = false)}
			node_id={node.id}
			current_at={node.overrided_at || node.at}
		/>
	</Dialog.Content>
</Dialog.Root>
