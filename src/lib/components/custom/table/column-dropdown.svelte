<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import Button from '@/components/ui/button/button.svelte';
	import { EllipsisIcon } from 'lucide-svelte';
	import { removeNode } from '@/db/mutations';
	import { invalidateAll } from '$app/navigation';
	import { cn } from '@/utils';
	import GenericPhaseMainLoadForm from '../load/generic-phase-main-load-form.svelte';
	import type { Node } from '@/types/project';
	import type { SuperValidated } from 'sveltekit-superforms';
	import type { PhaseMainLoadSchema } from '@/schema/load';

	let {
		node,
		phase_main_load_form,
		...props
	}: { node: Node; phase_main_load_form: SuperValidated<PhaseMainLoadSchema> } = $props();
	let is_dialog_open = $state(false);

	async function handleRemoveLoad() {
		await removeNode(node.id);
		await invalidateAll();
	}
</script>

<div class="grid w-full place-content-center">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			<Button size="icon" variant="outline">
				<EllipsisIcon class="size-4" />
			</Button>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading>Actions</DropdownMenu.GroupHeading>
				<DropdownMenu.Separator />
				<DropdownMenu.Item onclick={() => (is_dialog_open = true)}>Update</DropdownMenu.Item>
				<DropdownMenu.Item
					onclick={handleRemoveLoad}
					class="text-red-600 hover:!bg-red-600/20 hover:!text-red-600"
				>
					Remove
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
