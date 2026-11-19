import { voltage_drop_result_reuse } from './cache.js';
import { getSnapshotRevision, peekSnapshot } from './snapshot.js';
import { getRow, settled } from '../index.js';
import { engine } from '#lib/core/api.js';
import type { VoltageDrop } from '#lib/types/voltage-drop.js';

/** The voltage drop of every run, from the engine, cached per snapshot revision. */
export async function getComputedVoltageDropsAsync(): Promise<VoltageDrop[]> {
	for (;;) {
		// Pending writes answer first, so the revision read here is the one computed.
		await settled();
		const revision = getSnapshotRevision();
		if (voltage_drop_result_reuse.value && voltage_drop_result_reuse.revision === revision) {
			return voltage_drop_result_reuse.value;
		}
		const drops = await engine<(Partial<VoltageDrop> & { id: string })[]>('voltage_drops');
		// A write meanwhile makes these stale; ask again on the new revision.
		if (getSnapshotRevision() !== revision) continue;
		const { node_by_id } = peekSnapshot();
		const value = drops.map(
			(drop) =>
				({
					...node_by_id.get(drop.id),
					...getRow(drop.id),
					...drop,
					// The run's length, or undefined without one, whatever the node stored.
					length: drop.length
				}) as VoltageDrop
		);
		voltage_drop_result_reuse.revision = revision;
		voltage_drop_result_reuse.value = value;
		return value;
	}
}
