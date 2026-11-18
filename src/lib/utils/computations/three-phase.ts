import {
	LINE_PAIRS,
	PHASE_ASSIGNMENTS,
	THREE_PHASE_LOAD_TYPES,
	default_phases
} from '#lib/constants.js';
import type { CircuitPhase, PhaseAssignment } from '#lib/types/phase.js';

// Three-phase wye (400Y/230 V, 4-wire) per PEC 2017 2.20.1.5(A) and Appendix D
// Examples D6 and D8; three-phase delta (230 V, 3-wire) per 2.20.1.5(A) and D14/D15.
// Mirrors crates/heda-core/src/phases.rs for the checks the UI runs synchronously.

/** What a single-phase circuit connects to under a panel of `supply_phase`: phases, or line pairs on delta. */
export function phaseLabels(supply_phase: string | undefined): readonly PhaseAssignment[] {
	return supply_phase === default_phases.THREE_PHASE_DELTA ? LINE_PAIRS : PHASE_ASSIGNMENTS;
}

/**
 * Default phase (or line pair) of a single-phase circuit on a three-phase
 * panelboard, by circuit number. PEC 2017 App. D Ex. D6 6.1 asks for "balanced
 * distribution of single phase loads" but sets no numbering; heda rotates rows
 * of two circuits (odd/even pairs): 1–2 → A, 3–4 → B, 5–6 → C, 7–8 → A, …
 * (AB, BC, CA on delta).
 */
export function defaultPhaseAssignment(
	circuit_number: number | undefined,
	supply_phase?: string
): PhaseAssignment {
	const row = Math.max(Math.floor(((circuit_number ?? 1) - 1) / 2), 0);
	return phaseLabels(supply_phase)[row % 3]!;
}

/** What to store when a user picks `next`: nothing when it matches the circuit-number default. */
export function phaseOverride(
	next: PhaseAssignment,
	circuit_number: number | undefined,
	supply_phase?: string
): PhaseAssignment | undefined {
	return next === defaultPhaseAssignment(circuit_number, supply_phase) ? undefined : next;
}

/** The stored override when it fits the supply, else the circuit-number default. */
export function phaseOf(
	node: { circuit_number?: number; phase_assignment?: PhaseAssignment },
	supply_phase?: string
): PhaseAssignment {
	const override = node.phase_assignment;
	return override && phaseLabels(supply_phase).includes(override)
		? override
		: defaultPhaseAssignment(node.circuit_number, supply_phase);
}

/** VA a circuit puts on one phase: all of it on its own phase, a third of it for three-phase circuits. */
export function rowPhaseVa(
	row: { phase?: CircuitPhase; va?: number },
	phase: PhaseAssignment
): number | '' {
	if (row.phase === 'ABC') return Number(((row.va || 0) / 3).toFixed(2));
	return row.phase === phase ? row.va || 0 : '';
}

/** Line-to-line three-phase loads: 400 V on wye (PEC 2017 App. D Ex. D6), 230 V on delta (D14); motors per Table 4.30.14.4 at that voltage. */
export function isThreePhaseLoadType(load_type: string | undefined): boolean {
	return THREE_PHASE_LOAD_TYPES.includes(load_type ?? '');
}

/** The phase a node supplies to its circuits: the project's supply at the root, else the panel's. */
export function supplyPhaseOf(
	node:
		| {
				node_type?: string;
				highest_unit_form?: { phase?: string };
				panel_data?: { phase?: string };
		  }
		| undefined
): string | undefined {
	return node?.node_type === 'root' ? node.highest_unit_form?.phase : node?.panel_data?.phase;
}

/** A three-phase panel (3P-Y or delta), or a three-phase load, draws from all three lines. */
export function isThreePhaseCircuit(node: {
	panel_data?: { phase?: string };
	load_data?: { load_type?: string };
}): boolean {
	return (
		node.panel_data?.phase === default_phases.THREE_PHASE_WYE ||
		node.panel_data?.phase === default_phases.THREE_PHASE_DELTA ||
		isThreePhaseLoadType(node.load_data?.load_type)
	);
}

/** What a circuit draws from on a panel of `supply_phase`: all three lines, or its phase or pair. */
export function circuitPhase(
	node: {
		circuit_number?: number;
		phase_assignment?: PhaseAssignment;
		panel_data?: { phase?: string };
		load_data?: { load_type?: string };
	},
	supply_phase?: string
): CircuitPhase {
	return isThreePhaseCircuit(node) ? 'ABC' : phaseOf(node, supply_phase);
}

/** Whether a supply of this phase has three lines to give. */
function isThreePhaseSupply(phase: string | undefined): boolean {
	return phase === default_phases.THREE_PHASE_WYE || phase === default_phases.THREE_PHASE_DELTA;
}

/**
 * Why `node` cannot sit under `parent` with `children` below it, else null
 * (PEC 2017 2.20.1.5(A)). A three-phase circuit needs a three-phase supply; a 3P-Y
 * panel needs a 400Y/230 V one and a delta panel a 230 V delta one, since heda
 * models no transformer between them; a single-phase panel has only one phase
 * to give its circuits. Same rules and messages as `supply_error` in the engine.
 */
export function supplyError({
	node,
	parent,
	children = []
}: {
	node: Parameters<typeof isThreePhaseCircuit>[0] & Parameters<typeof supplyPhaseOf>[0];
	parent: Parameters<typeof supplyPhaseOf>[0];
	children?: Parameters<typeof isThreePhaseCircuit>[0][];
}): string | null {
	const supply = supplyPhaseOf(parent);
	const panel_phase = node.panel_data?.phase;
	if (panel_phase === default_phases.THREE_PHASE_WYE && supply !== panel_phase) {
		return 'A 3P-Y panel needs a 3P-Y (400Y/230 V) supply.';
	}
	if (panel_phase === default_phases.THREE_PHASE_DELTA && supply !== panel_phase) {
		return 'A 3P-Δ panel needs a 3P-Δ (230 V) supply.';
	}
	if (isThreePhaseCircuit(node) && !isThreePhaseSupply(supply)) {
		return 'A three-phase circuit needs a three-phase supply.';
	}
	if (
		!isThreePhaseSupply(supplyPhaseOf(node)) &&
		children.some((child) => isThreePhaseCircuit(child))
	) {
		return 'This panel feeds three-phase circuits, so it must stay three-phase.';
	}
	return null;
}
