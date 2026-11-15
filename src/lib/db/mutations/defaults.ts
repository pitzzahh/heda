import type { Node, Project } from '#lib/types/db/index.js';
import { NODE_DOC_SCHEMA } from '#lib/validators/db.js';

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
