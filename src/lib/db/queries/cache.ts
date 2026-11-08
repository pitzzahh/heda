import type { NodeByIdResult } from '#lib/types/db/index.js';
import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';

export const computed_load_reuse = new Map<
	string,
	{ is_dynamic: boolean; value: PhaseLoadSchedule }
>();
export const computed_load_array_reuse = new Map<
	string,
	{ is_dynamic: boolean; value: PhaseLoadSchedule[] }
>();
export const voltage_drop_reuse = new Map<string, { is_dynamic: boolean; value: VoltageDrop }>();
let voltage_drop_array_reuse: { is_dynamic: boolean; value: VoltageDrop[] } | null = null;
export const voltage_drop_result_reuse: { revision: number; value: VoltageDrop[] | null } = {
	revision: -1,
	value: null
};
export const node_by_id_reuse = new Map<string, { is_dynamic: boolean; value: NodeByIdResult }>();

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
	if (!previous) return next;
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
	computed_load_reuse.clear();
	computed_load_array_reuse.clear();
	voltage_drop_reuse.clear();
	voltage_drop_array_reuse = null;
	voltage_drop_result_reuse.revision = -1;
	voltage_drop_result_reuse.value = null;
	node_by_id_reuse.clear();
}

export function evictNodeFromCache(node_id: string): void {
	computed_load_reuse.delete(node_id);
	computed_load_array_reuse.delete(node_id);
	voltage_drop_reuse.delete(node_id);
	voltage_drop_result_reuse.revision = -1;
	voltage_drop_result_reuse.value = null;
	node_by_id_reuse.delete(node_id);
}

export function reuseVoltageDropArray(is_dynamic: boolean, next: VoltageDrop[]): VoltageDrop[] {
	const value =
		voltage_drop_array_reuse && voltage_drop_array_reuse.is_dynamic === is_dynamic
			? reuseArrayIfEqual(voltage_drop_array_reuse.value, next)
			: next;
	voltage_drop_array_reuse = { is_dynamic, value };
	return value;
}
