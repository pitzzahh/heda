import { computed_loads, short_circuit_result_reuse } from './cache.js';
import { getSnapshotRevision, loadSnapshot } from './snapshot.js';
import { computeShortCircuits } from './short-circuit-core.js';
import type { ShortCircuit } from '#lib/types/short-circuit.js';

/** The last computed fault currents, stale or not, without computing (for a hidden tab). */
export function peekComputedShortCircuits(): ShortCircuit[] {
	return short_circuit_result_reuse.value ?? [];
}

/** Fault currents for the whole tree, cached per snapshot revision. */
export function getComputedShortCircuits(): ShortCircuit[] {
	const revision = getSnapshotRevision();
	if (short_circuit_result_reuse.value && short_circuit_result_reuse.revision === revision) {
		return short_circuit_result_reuse.value;
	}
	const snapshot = loadSnapshot();
	const value = computeShortCircuits(snapshot.root, snapshot.node_by_id, {
		children_by_parent: snapshot.children_by_parent,
		is_dynamic: snapshot.is_dynamic,
		memo: computed_loads
	});
	short_circuit_result_reuse.revision = revision;
	short_circuit_result_reuse.value = value;
	return value;
}
