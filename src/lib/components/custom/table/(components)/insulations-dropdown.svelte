<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';

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
	import { changeInsulation } from '#lib/db/mutations';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';

	let { adjusted_current, type, current_insulation, node }: Props = $props();
	// Snapshot at mount: local edit state.
	function initialInsulation() {
		return current_insulation as Insulations;
	}
	let selected_insulation = $state<Insulations>(initialInsulation());
	let last_insulation_prop: string = initialInsulation();
	let undo_redo_state = getUndoRedoState();
	const db_revisions = getDbRevisionsState();

	// The table refreshes in place, so adopt external prop changes (undo/redo, auto-upgrade).
	$effect(() => {
		if (current_insulation !== last_insulation_prop) {
			last_insulation_prop = current_insulation;
			selected_insulation = current_insulation as Insulations;
		}
	});

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

	async function handleChangeInsulation(insulation: Insulations) {
		const updated_node = await changeInsulation({ node_id: node.id, insulation, type });
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
	<Select.Trigger class="w-26.25 text-xs">
		{#if selected_insulation}
			{selected_insulation}
		{:else}
			Select an insulation
		{/if}
	</Select.Trigger>
	<Select.Content class="text-sm">
		{#each insulations_to_map as insulation, i (i)}
			<Select.Item value={insulation} disabled={selected_insulation === insulation}>
				{insulation}
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
