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
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';

	let { adjusted_current, type, current_insulation, node }: Props = $props();
	// Writable derived: user picks override it until the next external prop change
	// (undo/redo, auto-upgrade) recomputes it, so no effect is needed to adopt those.
	let selected_insulation = $derived(current_insulation as Insulations);
	let undo_redo_state = getUndoRedoState();

	const insulations_to_map = $derived(
		type === 'egc'
			? insulations
			: adjusted_current > 100
				? insulations.filter((i) => i !== 'TW-Cu')
				: insulations
	);

	// Auto-upgrades TW-Cu once the adjusted current exceeds its rating.
	$effect(() => {
		if (adjusted_current > 100 && current_insulation === 'TW-Cu') {
			handleChangeInsulation('THHN-Cu');
		}
	});

	function handleChangeInsulation(insulation: Insulations) {
		const updated_node = changeInsulation({ node_id: node.id, insulation, type });
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated_node as unknown as PhaseLoadSchedule,
			previous_data: node
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
