<script lang="ts" module>
	import type { PhaseLoadSchedule } from '#lib/types/schedule.js';
	import type { PhaseAssignment } from '#lib/types/phase.js';

	interface Props {
		/** The three-phase panel (or root) whose circuits are balanced. */
		panel_id: string;
		/** The circuits of one three-phase panel (or root), as the schedule computes them. */
		loads: PhaseLoadSchedule[];
		/** That panel's phase: delta balances line pairs, 3P-Y phases. */
		supply_phase: string | undefined;
		/** The panel's unbalance in % (engine); absent at the supply. */
		unbalance?: number;
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
	import { phaseLabels, phaseOverride } from '#lib/utils/computations/index.js';
	import { engine } from '#lib/core/api.js';
	import { toast } from 'svelte-sonner';

	let { panel_id, loads, supply_phase, unbalance }: Props = $props();
	const labels = $derived(phaseLabels(supply_phase));

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
			// The engine weighs the panel's circuits from its own rows, current with every write.
			assignments = await engine('balance_panel', { panel_id });
		} catch (error) {
			console.error('Auto-balance failed:', error);
			toast.error('Could not balance the phases');
			return;
		}
		const by_id = new Map(loads.map((load) => [load.id, load]));
		applyChanges(
			assignments.map(([id, phase]) => [
				id,
				phaseOverride(phase, by_id.get(id)?.circuit_number, supply_phase)
			]),
			`Single-phase circuits balanced across ${labels.join(', ')}`
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
				{#if unbalance !== undefined}
					<span
						class="text-xs text-muted-foreground tabular-nums"
						title="Unbalance: largest deviation of the {labels[0]!.length > 1
							? 'line pair'
							: 'phase'} VA from their average (NEMA MG-1 14.35; PEC 2017 sets no limit)"
					>
						{unbalance.toFixed(2)} %
					</span>
				{/if}
				<CaretDownIcon class="size-3.5 opacity-60" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-72">
		<DropdownMenu.Item onclick={autoBalance}>
			<ScalesIcon />
			<div class="grid gap-0.5">
				<span class="text-sm">Auto-balance</span>
				<span class="text-xs text-muted-foreground">
					Largest load first onto the lightest {labels[0]!.length > 1 ? 'line pair' : 'phase'}
				</span>
			</div>
		</DropdownMenu.Item>
		<DropdownMenu.Item onclick={resetToCircuitNumbers}>
			<ArrowCounterClockwiseIcon />
			<div class="grid gap-0.5">
				<span class="text-sm">By circuit number</span>
				<span class="text-xs text-muted-foreground">
					1–2 on {labels[0]}, 3–4 on {labels[1]}, 5–6 on {labels[2]}, then repeat
				</span>
			</div>
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
