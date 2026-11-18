import { short_circuit_result_reuse } from './cache.js';
import { getSnapshotRevision, peekSnapshot } from './snapshot.js';
import { getRow, settled } from '../index.js';
import { engine } from '#lib/core/api.js';
import type { ShortCircuit } from '#lib/types/short-circuit.js';

/** Fault currents for the whole tree, from the engine, cached per snapshot revision. */
export async function getComputedShortCircuitsAsync(): Promise<ShortCircuit[]> {
	for (;;) {
		// Pending writes answer first, so the revision read here is the one computed.
		await settled();
		const revision = getSnapshotRevision();
		if (short_circuit_result_reuse.value && short_circuit_result_reuse.revision === revision) {
			return short_circuit_result_reuse.value;
		}
		const faults = await engine<(Partial<ShortCircuit> & { id: string })[]>('short_circuits');
		// A write meanwhile makes these stale; ask again on the new revision.
		if (getSnapshotRevision() !== revision) continue;
		const { node_by_id } = peekSnapshot();
		const value = faults.map(
			(fault) => ({ ...node_by_id.get(fault.id), ...getRow(fault.id), ...fault }) as ShortCircuit
		);
		short_circuit_result_reuse.revision = revision;
		short_circuit_result_reuse.value = value;
		return value;
	}
}
