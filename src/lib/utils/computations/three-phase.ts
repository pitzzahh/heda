import { PHASE_ASSIGNMENTS, THREE_PHASE_LOAD_TYPES, default_phases } from '#lib/constants.js';
import type { CircuitPhase, PhaseAssignment } from '#lib/types/phase.js';

// Three-phase wye (400Y/230 V, 4-wire) per PEC 2017 2.20.1.5(A) and Appendix D
// Examples D6 and D8.

const PHASES = PHASE_ASSIGNMENTS;

/**
 * Default phase of a single-phase circuit on a 3P-Y panelboard, by circuit
 * number. PEC 2017 App. D Ex. D6 6.1 asks for "balanced distribution of single
 * phase loads" but sets no numbering; heda rotates rows of two circuits
 * (odd/even pairs): 1–2 → A, 3–4 → B, 5–6 → C, 7–8 → A, …
 */
export function defaultPhaseAssignment(circuit_number: number | undefined): PhaseAssignment {
	const row = Math.max(Math.floor(((circuit_number ?? 1) - 1) / 2), 0);
	return PHASES[row % 3] as PhaseAssignment;
}

/** What to store when a user picks `next`: nothing when it matches the circuit-number default. */
export function phaseOverride(
	next: PhaseAssignment,
	circuit_number: number | undefined
): PhaseAssignment | undefined {
	return next === defaultPhaseAssignment(circuit_number) ? undefined : next;
}

/** The stored override, else the circuit-number default. */
export function phaseOf(node: {
	circuit_number?: number;
	phase_assignment?: PhaseAssignment;
}): PhaseAssignment {
	return node.phase_assignment ?? defaultPhaseAssignment(node.circuit_number);
}

/** VA a circuit puts on one phase: all of it on its own phase, a third of it for three-phase circuits. */
export function rowPhaseVa(
	row: { phase?: CircuitPhase; va?: number },
	phase: PhaseAssignment
): number | '' {
	if (row.phase === 'ABC') return Number(((row.va || 0) / 3).toFixed(2));
	return row.phase === phase ? row.va || 0 : '';
}

/** Line-to-line three-phase loads at 400 V (PEC 2017 App. D Ex. D6; 3-wire circuits per D6 6.2; motors per Table 4.30.14.4, 400 V column). */
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

/** A 3P-Y panel, or a load fed line-to-line, draws from all three phases. */
export function isThreePhaseCircuit(node: {
	panel_data?: { phase?: string };
	load_data?: { load_type?: string };
}): boolean {
	return (
		node.panel_data?.phase === default_phases.THREE_PHASE_WYE ||
		isThreePhaseLoadType(node.load_data?.load_type)
	);
}

/** The phases a circuit draws from when it sits on a 3P-Y panel. */
export function circuitPhase(node: {
	circuit_number?: number;
	phase_assignment?: PhaseAssignment;
	panel_data?: { phase?: string };
	load_data?: { load_type?: string };
}): CircuitPhase {
	return isThreePhaseCircuit(node) ? 'ABC' : phaseOf(node);
}

/**
 * Why `node` cannot sit under `parent` with `children` below it, else null.
 * Three-phase circuits (400 V loads and 3P-Y panels) need a 400Y/230 V supply
 * (PEC 2017 App. D Ex. D6, 2.20.1.5(A)); a single-phase panel has only one
 * phase and the neutral to give.
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
	if (isThreePhaseCircuit(node) && supplyPhaseOf(parent) !== default_phases.THREE_PHASE_WYE) {
		return 'A three-phase circuit needs a 3P-Y (400Y/230 V) supply.';
	}
	if (
		supplyPhaseOf(node) !== default_phases.THREE_PHASE_WYE &&
		children.some((child) => isThreePhaseCircuit(child))
	) {
		return 'This panel feeds three-phase circuits, so it must stay 3P-Y.';
	}
	return null;
}
