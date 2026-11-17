import type { Node, Project } from '#lib/types/db.js';
import { NODE_DOC_SCHEMA } from '#lib/validators/db.js';
import { default_phases } from '#lib/constants.js';
import { isThreePhaseLoadType } from '#lib/utils/computations/index.js';

// The store applies no defaults itself, so every insertion path merges these
// to keep stored documents complete.
const NODE_DEFAULTS = {
	conductor_sets: 1,
	conductor_qty: 2,
	conductor_insulation: 'THHN-Cu',
	egc_insulation: 'TW-Cu',
	conduit_type: 'PVC',
	pole: '2',
	kaic: '5',
	is_at_used_as_currents_value: false
} as const;

export function withNodeDefaults<T extends { id: string }>(node: T): T & typeof NODE_DEFAULTS {
	return { ...NODE_DEFAULTS, ...node };
}

/**
 * Breaker poles and conductor count of a new circuit on a 400Y/230 V system:
 * - 3P-Y sub-panel: 3-pole, three phase conductors + neutral (PEC 2017 App. D Ex. D6 6.3–6.4, D8 8.6–8.7);
 * - three-phase load: 3-pole, three wires (D6 6.2 "3-wire", D9 9.2);
 * - single-phase 230 V load or panel: 1-pole, line + neutral (D6 6.2 "2-wire", D7 7.4).
 * Single-phase systems keep NODE_DEFAULTS.
 */
export function circuitDefaults(
	node: { panel_data?: { phase?: string }; load_data?: { load_type?: string } },
	system_phase: string | undefined
): { pole?: string; conductor_qty?: number } {
	if (system_phase !== default_phases.THREE_PHASE_WYE) return {};
	if (node.panel_data?.phase === default_phases.THREE_PHASE_WYE) {
		return { pole: '3', conductor_qty: 4 };
	}
	if (isThreePhaseLoadType(node.load_data?.load_type)) return { pole: '3', conductor_qty: 3 };
	return { pole: '1', conductor_qty: 2 };
}

/** The pole and conductor count a circuit like `node` gets when it is inserted. */
export function poleAndQtyDefaults(
	node: Parameters<typeof circuitDefaults>[0],
	system_phase: string | undefined
): { pole: string; conductor_qty: number } {
	return {
		pole: NODE_DEFAULTS.pole,
		conductor_qty: NODE_DEFAULTS.conductor_qty,
		...circuitDefaults(node, system_phase)
	};
}

export function withProjectDefaults<T extends { id: string; settings: Project['settings'] }>(
	project: T
): T {
	return {
		...project,
		settings: { is_adjustment_factor_dynamic: false, ...project.settings }
	};
}

const NODE_KEYS = Object.keys(NODE_DOC_SCHEMA.entries) as (keyof Node)[];

/**
 * A full replacement for a stored node: every field the snapshot lacks is set
 * to undefined, so restoring it also clears what was added since (a phase
 * override, say).
 */
export function toRestoredNode(value: Node): Node {
	const cleared = Object.fromEntries(NODE_KEYS.map((key) => [key, undefined]));
	return { ...cleared, ...toStoredNode(value) } as Node;
}

/**
 * Keeps only the stored fields of a node. Undo history and table rows carry
 * computed values (`at`, `va`, `load_description`, …) that must never be
 * written back, or they would sit in the store and the saved file forever.
 */
export function toStoredNode(value: Node): Node {
	const node: Record<string, unknown> = {};
	for (const key of NODE_KEYS) {
		if (key in value) node[key] = value[key];
	}
	return node as Node;
}
