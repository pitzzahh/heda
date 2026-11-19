<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

	interface Props {
		kaic: number;
		node: PhaseLoadSchedule;
	}
</script>

<script lang="ts">
	import { updateInterruptingRating } from '#lib/db/mutations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { kaic, node }: Props = $props();
	// Writable derived: the draft follows the stored rating (undo/redo) until the user types.
	let kaic_value = $derived<number | null>(kaic);

	let undo_redo_state = getUndoRedoState();

	/** Saves on blur; a cleared or non-positive draft falls back to the stored rating. */
	function commit() {
		if (kaic_value === kaic) return;
		if (!kaic_value || kaic_value <= 0) {
			kaic_value = kaic;
			return;
		}
		const value = kaic_value;
		const previous_node = getNode(node.id);
		const updated = updateInterruptingRating({ node_id: node.id, kaic: value });
		if (!updated) {
			kaic_value = kaic;
			toast.warning('Failed to update the interrupting rating');
			return;
		}
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated as unknown as PhaseLoadSchedule,
			previous_data: previous_node as unknown as PhaseLoadSchedule
		});
		toast.success(`Interrupting rating set to ${value} kA`);
	}
</script>

<input
	type="number"
	min="0"
	step="any"
	aria-label="Interrupting rating (kA)"
	bind:value={kaic_value}
	onblur={commit}
	onkeydown={(e) => {
		if (e.key === 'Enter') e.currentTarget.blur();
		if (e.key === 'Escape') {
			kaic_value = kaic;
			e.currentTarget.blur();
		}
	}}
	class="w-16 [appearance:textfield] bg-transparent p-2 text-center outline-primary focus:outline [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
/>
