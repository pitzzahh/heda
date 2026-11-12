<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

	interface Props {
		load_description: string;
		node_id: string;
		node_type: 'panel' | 'load';
	}

	const SEPARATOR = ' - ';

	/** Loads are stored as "<quantity> - <name>"; only the name is edited in the cell. */
	function splitDescription(value: string, node_type: Props['node_type']) {
		const at = node_type === 'load' ? value.indexOf(SEPARATOR) : -1;
		if (at === -1) return { prefix: null, name: value };
		return { prefix: value.slice(0, at), name: value.slice(at + SEPARATOR.length) };
	}
</script>

<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { updateLoadDescription } from '#lib/db/mutations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { load_description, node_id, node_type }: Props = $props();

	// Non-null only while the input is focused; otherwise the stored value shows.
	let draft = $state<string | null>(null);
	const parts = $derived(splitDescription(load_description, node_type));

	const undo_redo_state = getUndoRedoState();

	function commit() {
		if (draft === null) return;
		const name = draft.trim();
		draft = null;
		if (!name || name === parts.name) return;

		const previous_node = getNode(node_id);
		const updated_node = updateLoadDescription({
			node_id,
			load_description: parts.prefix === null ? name : `${parts.prefix}${SEPARATOR}${name}`,
			node_type
		});
		if (!updated_node || !previous_node) {
			toast.error(`Could not rename this ${node_type}.`);
			return;
		}
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated_node as unknown as PhaseLoadSchedule,
			previous_data: previous_node as unknown as PhaseLoadSchedule
		});
		toast.success(node_type === 'panel' ? 'Panel name updated' : 'Load description updated');
	}

	function handleKeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key === 'Escape') draft = null;
		if (event.key === 'Enter' || event.key === 'Escape') {
			event.preventDefault();
			event.currentTarget.blur();
		}
	}
</script>

<input
	type="text"
	aria-label={node_type === 'panel' ? 'Panel name' : 'Load description'}
	value={draft ?? load_description}
	onfocus={() => (draft = parts.name)}
	oninput={(event) => (draft = event.currentTarget.value)}
	onblur={commit}
	onkeydown={handleKeydown}
	class="w-full bg-transparent p-2 text-center outline-primary focus:outline"
/>
