<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import type { CircuitPhase } from '#lib/types/phase.js';
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
	import PhaseDropdown from './phase-dropdown.svelte';

	let { phase, supply_phase }: { phase: CircuitPhase; supply_phase?: string } = $props();

	setUndoRedoState();
</script>

<PhaseDropdown
	{phase}
	{supply_phase}
	node={{ id: 'node-a', parent_id: 'panel', circuit_number: 3 } as unknown as PhaseLoadSchedule}
/>
