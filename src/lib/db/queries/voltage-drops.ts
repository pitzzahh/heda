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
 * Async entry point for the UI. Computes on the main thread (no worker clone of
 * the full node graph) so cost scales with the walk, not with cloning thousands
 * of rich objects. Callers defer dispatch off the click/flush path; results are
 * cached by snapshot revision.
 */
export async function getComputedVoltageDropsAsync(): Promise<VoltageDrop[]> {
	const revision = getSnapshotRevision();
	if (voltage_drop_result_reuse.value && voltage_drop_result_reuse.revision === revision) {
		return voltage_drop_result_reuse.value;
	}

	// Yield once so callers that forgot to defer don't block the current turn.
	await Promise.resolve();
	return getComputedVoltageDrops();
}
