<script lang="ts">
	import * as DropdownMenu from '@/components/ui/dropdown-menu/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { Button } from '@/components/ui/button';
	import { Ellipsis, Pencil, Trash2 } from '@/assets/icons';
	import { removeNode } from '@/db/mutations';
	import { invalidateAll } from '$app/navigation';
	import GenericPhaseMainLoadForm from '@/components/custom/load/generic-phase-main-load-form.svelte';
	import type { Node } from '@/types/project';
	import { ConfirmationDialog } from '@/components/custom';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { GenericPhaseMainLoadSchema } from '@/schema/load';

	let {
		node,
		phase_main_load_form,
		...props
	}: { node: Node; phase_main_load_form: SuperValidated<GenericPhaseMainLoadSchema> } = $props();
	let is_dialog_open = $state(false);

	let open_dropdown_menu = $state(false);

	async function handleRemoveLoad() {
		await removeNode(node.id);
		await invalidateAll();
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
				<DropdownMenu.Item onclick={() => (is_dialog_open = true)}>
					<Pencil /> Update</DropdownMenu.Item
				>
				<DropdownMenu.Item class="mt-0.5 p-0">
					{#snippet children()}
						<ConfirmationDialog
							trigger_text="Remove load"
							trigger_variant="destructive"
							bind:some_open_state={open_dropdown_menu}
							onConfirm={handleRemoveLoad}
						/>
					{/snippet}
				</DropdownMenu.Item>
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<Dialog.Root {...props} bind:open={is_dialog_open}>
	<Dialog.Content class="max-w-[70%]">
		<Dialog.Header>
			<Dialog.Title>Update load</Dialog.Title>
			<Dialog.Description>Edit the load details.</Dialog.Description>
			<!-- <div class={cn('flex flex-col items-center justify-start')}>
				<h4 class="mb-1 font-bold">MAIN</h4>
				<div class="grid w-full grid-cols-2 justify-items-start">
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Name:</h4>
							<p>{distribution_unit ?? 'N/A'}</p>
						</div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Terminal temperature:</h4>
							<p>{ambient_temperature ?? 'N/A'}</p>
						</div>
					</div>
					<div>
						<div class="flex gap-1">
							<h4 class="font-semibold">Phase:</h4>
							<p>{phase ?? 'N/A'}</p>
						</div>
					</div>
				</div>
			</div> -->
		</Dialog.Header>
		<GenericPhaseMainLoadForm
			action={'edit'}
			closeDialog={() => (is_dialog_open = false)}
			{phase_main_load_form}
			load_to_edit={node}
		/>
	</Dialog.Content>
</Dialog.Root>
