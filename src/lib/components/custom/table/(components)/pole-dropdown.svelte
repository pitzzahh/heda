<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

	interface Props {
		current_pole: '1' | '2';
		node: PhaseLoadSchedule;
	}
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { changePole } from '#lib/db/mutations/index.js';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { node, current_pole }: Props = $props();
	// User picks override until undo/redo recomputes it.
	let selected_pole = $derived(current_pole);

	let undo_redo_state = getUndoRedoState();

	function handleChangePole(pole: '1' | '2') {
		const updated_node = changePole(node.id, pole);
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated_node as unknown as PhaseLoadSchedule,
			previous_data: node
		});
	}
</script>

<Select.Root
	type="single"
	bind:value={selected_pole}
	onOpenChange={(value) => {
		if (!value && current_pole !== selected_pole) {
			handleChangePole(selected_pole);
			toast.success(`Pole changed from ${current_pole} to ${selected_pole}`);
		}
	}}
>
	<Select.Trigger class="w-12.5 text-xs">
		{#if selected_pole}
			{selected_pole}
		{:else}
			Select a pole
		{/if}
	</Select.Trigger>
	<Select.Content class="text-sm">
		{#each ['1', '2'] as pole (pole)}
			<Select.Item value={pole} disabled={selected_pole === pole}>
				{pole}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
