import type { NodeByIdResult } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';

// Per-node results that depend only on the node and its descendants. They
// survive across revisions; the load snapshot evicts changed nodes and their
// ancestors (see `invalidateComputed`), so an edit recomputes one branch.
export const computed_loads = new Map<string, PhaseLoadSchedule>();
export const node_results = new Map<string, NodeByIdResult>();

// Last value handed to the UI, kept so an unchanged result keeps its identity.
export const computed_load_arrays = new Map<string, PhaseLoadSchedule[]>();
export const node_by_id_reuse = new Map<string, NodeByIdResult>();

export const voltage_drop_result_reuse: { revision: number; value: VoltageDrop[] | null } = {
	revision: -1,
	value: null
};

export function isSameValue(a: unknown, b: unknown): boolean {
	if (Object.is(a, b)) return true;
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		for (let index = 0; index < a.length; index += 1) {
			if (!isSameValue(a[index], b[index])) return false;
		}
		return true;
	}
	const a_keys = Object.keys(a);
	const b_keys = Object.keys(b);
	if (a_keys.length !== b_keys.length) return false;
	for (const key of a_keys) {
		if (!isSameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
			return false;
	}
	return true;
}

export function reuseIfEqual<T extends object>(previous: T | undefined, next: T): T {
	if (!previous || previous === next) return next;
	if (Object.keys(previous).length !== Object.keys(next).length) return next;
	for (const key of Object.keys(next)) {
		if (!isSameValue(previous[key as keyof T], next[key as keyof T])) return next;
	}
	return previous;
}

export function reuseArrayIfEqual<T>(previous: T[] | undefined, next: T[]): T[] {
	if (!previous || previous.length !== next.length) return next;
	for (let index = 0; index < next.length; index += 1) {
		if (!Object.is(previous[index], next[index])) return next;
	}
	return previous;
}

export function clearQueryCache(): void {
	computed_loads.clear();
	node_results.clear();
	computed_load_arrays.clear();
	node_by_id_reuse.clear();
	voltage_drop_result_reuse.revision = -1;
	voltage_drop_result_reuse.value = null;
}

export function evictNodeFromCache(node_id: string): void {
	computed_loads.delete(node_id);
	node_results.delete(node_id);
}
