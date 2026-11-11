<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';

	interface Props {
		adjusted_current: number;
		type: 'conductor' | 'egc';
		current_insulation: string;
		node: PhaseLoadSchedule;
	}

	const insulations = ['TW-Cu', 'THWN-Cu', 'THWN-2-Cu', 'THHN-Cu'] as const;

	type Insulations = (typeof insulations)[number];
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { changeInsulation } from '#lib/db/mutations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { adjusted_current, type, current_insulation, node }: Props = $props();
	// User picks override until undo/redo recomputes it.
	let selected_insulation = $derived(current_insulation as Insulations);
	let undo_redo_state = getUndoRedoState();

	const insulations_to_map = $derived(
		type === 'egc'
			? insulations
			: adjusted_current > 100
				? insulations.filter((i) => i !== 'TW-Cu')
				: insulations
	);

	// Silent repair: TW-Cu past its rating upgrades without an undo entry, since
	// it was never a user action; the file is still marked unsaved so it persists.
	$effect(() => {
		if (adjusted_current > 100 && current_insulation === 'TW-Cu') {
			changeInsulation({ node_id: node.id, insulation: 'THHN-Cu', type });
			undo_redo_state.setHasUnsavedActions();
		}
	});

	function handleChangeInsulation(insulation: Insulations) {
		const previous_node = getNode(node.id);
		const updated_node = changeInsulation({ node_id: node.id, insulation, type });
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated_node as unknown as PhaseLoadSchedule,
			previous_data: previous_node as unknown as PhaseLoadSchedule
		});
	}
</script>

<Select.Root
	type="single"
	bind:value={selected_insulation}
	onOpenChange={(value) => {
		if (!value && current_insulation !== selected_insulation) {
			handleChangeInsulation(selected_insulation);
			toast.success(
				`${type === 'conductor' ? "Conductor's" : "EGC's"} insulation changed from ${current_insulation} to ${selected_insulation}`
			);
		}
	}}
>
	<Select.Trigger class="w-26.25 text-xs">
		{#if selected_insulation}
			{selected_insulation}
		{:else}
			Select an insulation
		{/if}
	</Select.Trigger>
	<Select.Content class="text-sm">
		{#each insulations_to_map as insulation (insulation)}
			<Select.Item value={insulation} disabled={selected_insulation === insulation}>
				{insulation}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
