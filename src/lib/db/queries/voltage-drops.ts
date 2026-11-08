import { voltage_drop_result_reuse } from './cache.js';
import { getSnapshotRevision, loadSnapshot } from './snapshot.js';
import { computeVoltageDropsFromNodes } from './voltage-drop-core.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';

export function getComputedVoltageDrops(): VoltageDrop[] {
	const revision = getSnapshotRevision();
	if (voltage_drop_result_reuse.value && voltage_drop_result_reuse.revision === revision) {
		return voltage_drop_result_reuse.value;
	}

	const snapshot = loadSnapshot();
	const result = computeVoltageDropsFromNodes(snapshot.nodes, snapshot.is_dynamic);

	if (getSnapshotRevision() === revision) {
		voltage_drop_result_reuse.revision = revision;
		voltage_drop_result_reuse.value = result;
	}
	return result;
}

/**
 * Async variant that offloads the tree walk to a Web Worker when available,
 * falling back to the synchronous path. Updates the same revision cache so
 * subsequent synchronous reads are instant.
 */
export async function getComputedVoltageDropsAsync(): Promise<VoltageDrop[]> {
	const revision = getSnapshotRevision();
	if (voltage_drop_result_reuse.value && voltage_drop_result_reuse.revision === revision) {
		return voltage_drop_result_reuse.value;
	}

	const snapshot = loadSnapshot();
	try {
		const { computeVoltageDropsInWorker } = await import('#lib/workers/compute-client.js');
		const result = await computeVoltageDropsInWorker(snapshot.nodes, snapshot.is_dynamic);
		if (getSnapshotRevision() === revision) {
			voltage_drop_result_reuse.revision = revision;
			voltage_drop_result_reuse.value = result;
		}
		return result;
	} catch {
		return getComputedVoltageDrops();
	}
}
