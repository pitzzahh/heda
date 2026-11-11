<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

	interface Props {
		load_description: string;
		node_id: string;
		node_type: 'panel' | 'load';
	}
</script>

<script lang="ts">
	import { IsFocusWithin } from 'runed';
	import { toast } from 'svelte-sonner';
	import { updateLoadDescription } from '#lib/db/mutations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { load_description, node_id, node_type }: Props = $props();
	const load_description_suffix = $derived(load_description.split(' - ').at(-1));
	// Snapshot at mount: local edit state, never tracks later prop changes.
	function initialDescription() {
		return load_description;
	}
	let load_description_state = $state(initialDescription());
	let last_description_prop = initialDescription();
	let formElement = $state<HTMLFormElement>();
	const focusWithinForm = new IsFocusWithin(() => formElement);

	let undo_redo_state = getUndoRedoState();

	function saveLoadDescChanges() {
		try {
			const previous_node = getNode(node_id);
			const updated_node = updateLoadDescription({
				node_id,
				load_description:
					node_type === 'load'
						? (load_description.split(' - ').at(0) as string) + ' - ' + load_description_state
						: load_description_state,
				node_type
			});
			undo_redo_state.setActionToUndo({
				action: 'update_node',
				data: updated_node as unknown as PhaseLoadSchedule,
				previous_data: previous_node as unknown as PhaseLoadSchedule
			});
			toast.success('Load description updated successfully');
		} catch (err) {
			console.error(`Error: failed to update load description: ${JSON.stringify(err)}`);
			toast.error('An error occured while updating the load description');
		}
	}

	// Swaps the editable suffix on focus and persists the edit on blur. External prop
	// changes (undo/redo, refreshes) are adopted first so they aren't re-saved.
	$effect(() => {
		if (load_description !== last_description_prop) {
			last_description_prop = load_description;
			if (!focusWithinForm.current) load_description_state = load_description;
			return;
		}

		if (focusWithinForm.current && node_type === 'load') {
			load_description_state = load_description_suffix as string;
		}

		if (!focusWithinForm.current) {
			if (
				node_type === 'panel' &&
				load_description_state !== load_description &&
				load_description_state
			) {
				saveLoadDescChanges();
			} else load_description_state = load_description;

			if (
				node_type === 'load' &&
				load_description_state !== load_description &&
				load_description_state !== load_description_suffix &&
				load_description_state
			) {
				saveLoadDescChanges();
			} else {
				load_description_state = load_description;
			}
		}
	});
</script>

<form bind:this={formElement}>
	<input
		type="text"
		bind:value={load_description_state}
		class="outline-primary w-full [appearance:textfield] bg-transparent p-2 text-center focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>
</form>
