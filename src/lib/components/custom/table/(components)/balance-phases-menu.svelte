<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
	import type { PhaseAssignment } from '#lib/types/phase.js';

	interface Props {
		/** The circuits of one 3P-Y panel (or a 3P-Y root), as the schedule computes them. */
		loads: PhaseLoadSchedule[];
	}

	type PhaseChange = [node_id: string, PhaseAssignment | undefined];
</script>

<script lang="ts">
	import { ArrowCounterClockwiseIcon, CaretDownIcon, ScalesIcon } from '#lib/assets/icons.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { changePhaseAssignments } from '#lib/db/mutations/index.js';
	import { getNode } from '#lib/db/queries/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { phaseOverride } from '#lib/utils/computations/index.js';
	import { engine } from '#lib/core/api.js';
	import { toast } from 'svelte-sonner';

	let { loads }: Props = $props();

	const undo_redo_state = getUndoRedoState();

	function applyChanges(changes: PhaseChange[], message: string) {
		const changed = changes.filter(([id, phase]) => getNode(id)?.phase_assignment !== phase);
		if (changed.length === 0) {
			toast.info('Phases are already set that way');
			return;
		}
		const previous = changed.flatMap(([id]) => getNode(id) ?? []);
		changePhaseAssignments(changed);
		undo_redo_state.setActionToUndo({
			action: 'batch_update',
			batch_data: previous.map((node) => ({ data: node as unknown as PhaseLoadSchedule }))
		});
		toast.success(message);
	}

	async function autoBalance() {
		let assignments: [string, PhaseAssignment][];
		try {
			assignments = await engine('balanced_phases', {
				circuits: loads.map((load) => ({
					id: load.id,
					va: load.va || 0,
					phase: load.phase ?? 'ABC'
				}))
			});
		} catch (error) {
			console.error('Auto-balance failed:', error);
			toast.error('Could not balance the phases');
			return;
		}
		const by_id = new Map(loads.map((load) => [load.id, load]));
		applyChanges(
			assignments.map(([id, phase]) => [id, phaseOverride(phase, by_id.get(id)?.circuit_number)]),
			'Single-phase circuits balanced across A, B and C'
		);
	}

	function resetToCircuitNumbers() {
		applyChanges(
			loads.filter((load) => load.phase !== 'ABC').map((load) => [load.id, undefined]),
			'Phases follow the circuit numbers again'
		);
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button size="sm" variant="outline" {...props}>
				<ScalesIcon class="size-4" />
				Phases
				<CaretDownIcon class="size-3.5 opacity-60" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-72">
		<DropdownMenu.Item onclick={autoBalance}>
			<ScalesIcon />
			<div class="grid gap-0.5">
				<span class="text-sm">Auto-balance</span>
				<span class="text-xs text-muted-foreground">Largest load first onto the lightest phase</span
				>
			</div>
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={resetToCircuitNumbers}>
			<ArrowCounterClockwiseIcon />
			<div class="grid gap-0.5">
				<span class="text-sm">By circuit number</span>
				<span class="text-xs text-muted-foreground">1–2 on A, 3–4 on B, 5–6 on C, then repeat</span>
			</div>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
