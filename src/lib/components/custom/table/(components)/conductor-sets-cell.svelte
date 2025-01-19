<script lang="ts">
	import { IsFocusWithin } from 'runed';
	import { updateConductorSets } from '@/db/mutations';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';

	let { sets, node }: { sets: number; node: PhaseLoadSchedule } = $props();
	let sets_value = $state(sets);
	let formElement = $state<HTMLFormElement>();
	const focusWithinForm = new IsFocusWithin(() => formElement);

	let undo_redo_state = getUndoRedoState();

	async function saveSetsChanges() {
		try {
			const updated_set = await updateConductorSets({
				node_id: node.id,
				sets: !sets_value ? 1 : sets_value
			});

			sets_value = updated_set?.conductor_sets as number;
			undo_redo_state.setActionToUndo({
				action: 'update_node',
				data: updated_set as unknown as PhaseLoadSchedule,
				previous_data: node
			});
			invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
			toast.success('Sets updated successfully');
		} catch (err) {
			console.error(`An error occured while updating the sets: ${JSON.stringify(err)}`);
		}
	}

	$effect(() => {
		if (!focusWithinForm.current && sets_value !== sets) {
			if (sets_value && sets_value >= 1) {
				saveSetsChanges();
			} else {
				sets_value = sets;
			}
		}
	});
</script>

<form bind:this={formElement}>
	<input
		type="number"
		bind:value={sets_value}
		class="w-16 bg-transparent p-2 text-center outline-primary [appearance:textfield] focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>
</form>
