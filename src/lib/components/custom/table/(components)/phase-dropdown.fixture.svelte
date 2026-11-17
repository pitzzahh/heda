<script lang="ts">
	import { setUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import type { CircuitPhase } from '#lib/types/phase.js';
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
	import PhaseDropdown from './phase-dropdown.svelte';

	let { phase }: { phase: CircuitPhase } = $props();

	setUndoRedoState();
</script>

<PhaseDropdown
	{phase}
	node={{ id: 'node-a', parent_id: 'panel', circuit_number: 3 } as unknown as PhaseLoadSchedule}
/>
