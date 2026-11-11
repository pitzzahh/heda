<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

	interface Props {
		sets: number;
		node: PhaseLoadSchedule;
	}
</script>

<script lang="ts">
	import { IsFocusWithin } from 'runed';
	import { updateConductorSets } from '#lib/db/mutations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { sets, node }: Props = $props();
	// Snapshot at mount: local edit state.
	function initialSets() {
		return sets;
	}
	let sets_value = $state(initialSets());
	let last_sets_prop = initialSets();
	let formElement = $state<HTMLFormElement>();
	const focusWithinForm = new IsFocusWithin(() => formElement);

	let undo_redo_state = getUndoRedoState();

	function saveSetsChanges() {
		try {
			const previous_node = getNode(node.id);
			const updated_set = updateConductorSets({
				node_id: node.id,
				sets: !sets_value ? 1 : sets_value
			});

			sets_value = updated_set?.conductor_sets as number;
			undo_redo_state.setActionToUndo({
				action: 'update_node',
				data: updated_set as unknown as PhaseLoadSchedule,
				previous_data: previous_node as unknown as PhaseLoadSchedule
			});
			toast.success('Sets updated successfully');
		} catch (err) {
			console.error(`An error occured while updating the sets: ${JSON.stringify(err)}`);
		}
	}

	// Persists the edit on blur, or reverts the draft when cleared. External prop
	// changes (undo/redo, refreshes) are adopted first so they aren't re-saved.
	$effect(() => {
		if (sets !== last_sets_prop) {
			last_sets_prop = sets;
			if (!focusWithinForm.current) sets_value = sets;
			return;
		}

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
		class="w-16 [appearance:textfield] bg-transparent p-2 text-center outline-primary focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>
</form>
