<script lang="ts">
	import { invalidate } from '$app/navigation';
	import * as Select from '$lib/components/ui/select/index.js';
	import { changePole } from '@/db/mutations';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';

	interface Props {
		current_pole: '1' | '2';
		node: PhaseLoadSchedule;
	}

	let { node, current_pole }: Props = $props();
	let selected_pole = $state<'1' | '2'>(current_pole);

	let undo_redo_state = getUndoRedoState();

	async function handleChangeInsulation(pole: '1' | '2') {
		const updated_node = await changePole(node.id, pole);
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated_node as unknown as PhaseLoadSchedule,
			previous_data: node
		});
		invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
	}
</script>

<Select.Root
	type="single"
	bind:value={selected_pole}
	onOpenChange={async (value) => {
		if (!value && current_pole !== selected_pole) {
			await handleChangeInsulation(selected_pole);
			toast.success(`Pole changed from ${current_pole} to ${selected_pole}`);
		}
	}}
>
	<Select.Trigger class="w-[50px] text-xs"
		>{selected_pole ? selected_pole : 'Select a pole'}</Select.Trigger
	>
	<Select.Content class="text-sm">
		{#each ['1', '2'] as pole, i (i)}
			<Select.Item value={pole} disabled={selected_pole === pole}>
				{pole}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
