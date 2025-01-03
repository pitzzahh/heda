<script lang="ts">
	import { invalidate } from '$app/navigation';
	import * as Select from '$lib/components/ui/select/index.js';
	import { changeInsulation } from '@/db/mutations';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';

	interface Props {
		adjusted_current: number;
		type: 'conductor' | 'egc';
		current_insulation: string;
		node: PhaseLoadSchedule;
	}
	type Insulations = (typeof insulations)[number];

	let { adjusted_current, type, current_insulation, node }: Props = $props();
	let selected_insulation = $state<Insulations>(current_insulation as Insulations);
	let undo_redo_state = getUndoRedoState();

	const insulations = ['TW-Cu', 'THWN-Cu', 'THWN-2-Cu', 'THHN-Cu'] as const;
	const insulations_to_map =
		type === 'egc'
			? insulations
			: adjusted_current > 100
				? insulations.filter((i) => i !== 'TW-Cu')
				: insulations;

	$effect(() => {
		if (adjusted_current > 100 && current_insulation === 'TW-Cu') {
			handleChangeInsulation('THHN-Cu');
		}
	});

	async function handleChangeInsulation(insulation: Insulations) {
		const updated_node = await changeInsulation({ node_id: node.id, insulation, type });
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
	bind:value={selected_insulation}
	onOpenChange={async (value) => {
		if (!value && current_insulation !== selected_insulation) {
			await handleChangeInsulation(selected_insulation);
			toast.success(
				`${type === 'conductor' ? "Conductor's" : "EGC's"} insulation changed from ${current_insulation} to ${selected_insulation}`
			);
		}
	}}
>
	<Select.Trigger class="w-[105px] text-xs"
		>{selected_insulation ? selected_insulation : 'Select an insulation'}</Select.Trigger
	>
	<Select.Content class="text-sm">
		{#each insulations_to_map as insulation, i (i)}
			<Select.Item value={insulation} disabled={selected_insulation === insulation}>
				{insulation}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
