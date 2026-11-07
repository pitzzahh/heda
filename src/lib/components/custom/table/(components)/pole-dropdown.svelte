<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';

	interface Props {
		current_pole: '1' | '2';
		node: PhaseLoadSchedule;
	}
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { changePole } from '#lib/db/mutations';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';

	let { node, current_pole }: Props = $props();
	// Snapshot at mount: local edit state.
	function initialPole() {
		return current_pole;
	}
	let selected_pole = $state<'1' | '2'>(initialPole());
	let last_pole_prop = initialPole();

	// The table refreshes in place, so adopt external prop changes (undo/redo, refreshes).
	$effect(() => {
		if (current_pole !== last_pole_prop) {
			last_pole_prop = current_pole;
			selected_pole = current_pole;
		}
	});

	let undo_redo_state = getUndoRedoState();
	const db_revisions = getDbRevisionsState();

	async function handleChangeInsulation(pole: '1' | '2') {
		const updated_node = await changePole(node.id, pole);
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated_node as unknown as PhaseLoadSchedule,
			previous_data: node
		});
		db_revisions.bumpWorkspaceAndSchedule();
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
	<Select.Trigger class="w-12.5 text-xs">
		{#if selected_pole}
			{selected_pole}
		{:else}
			Select a pole
		{/if}
	</Select.Trigger>
	<Select.Content class="text-sm">
		{#each ['1', '2'] as pole, i (i)}
			<Select.Item value={pole} disabled={selected_pole === pole}>
				{pole}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
