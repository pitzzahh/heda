<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
	import type { CircuitPhase, PhaseAssignment } from '#lib/types/phase.js';

	interface Props {
		phase: CircuitPhase;
		node: PhaseLoadSchedule;
		/** The panel's phase: line pairs to pick from on delta, else A, B, C. */
		supply_phase?: string;
	}
</script>

<script lang="ts">
	import * as Select from '#lib/components/ui/select/index.js';
	import { changePhaseAssignment } from '#lib/db/mutations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { toast } from 'svelte-sonner';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { phaseLabels, phaseOverride } from '#lib/utils/computations/index.js';

	let { node, phase, supply_phase }: Props = $props();
	// User picks override until undo/redo recomputes it.
	let selected_phase = $derived(phase);

	let undo_redo_state = getUndoRedoState();

	function handleChangePhase(next: PhaseAssignment) {
		const previous_node = getNode(node.id);
		// Picking the circuit-number phase clears the override instead of pinning it.
		const updated_node = changePhaseAssignment(
			node.id,
			phaseOverride(next, node.circuit_number, supply_phase)
		);
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			data: updated_node as unknown as PhaseLoadSchedule,
			previous_data: previous_node as unknown as PhaseLoadSchedule
		});
	}
</script>

{#if phase === 'ABC'}
	<!-- Three-phase circuits draw from all phases; nothing to pick. -->
	<span class="text-xs font-medium">ABC</span>
{:else}
	<Select.Root
		type="single"
		bind:value={selected_phase}
		onOpenChange={(open) => {
			if (!open && selected_phase !== phase && selected_phase !== 'ABC') {
				handleChangePhase(selected_phase);
				toast.success(`Phase changed from ${phase} to ${selected_phase}`);
			}
		}}
	>
		<Select.Trigger size="sm" class="w-14 text-xs" aria-label="Phase">
			{selected_phase}
		</Select.Trigger>
		<Select.Content class="text-sm">
			{#each phaseLabels(supply_phase) as option (option)}
				<Select.Item value={option} disabled={selected_phase === option}>
					{option}
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{/if}
