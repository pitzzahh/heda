import type { Project } from '#lib/types/db/index.js';

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
