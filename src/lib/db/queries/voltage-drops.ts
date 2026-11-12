import { computed_loads, voltage_drop_result_reuse } from './cache.js';
import { getSnapshotRevision, loadSnapshot, peekSnapshot, type LoadSnapshot } from './snapshot.js';
import { walkVoltageDrops } from './voltage-drop-core.js';
import { nextTask } from './loads.js';
import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';

// Work done per task before yielding back to the event loop.
const SLICE_MS = 8;

function walk(snapshot: LoadSnapshot) {
	return walkVoltageDrops(snapshot.root, snapshot.node_by_id, {
		children_by_parent: snapshot.children_by_parent,
		is_dynamic: snapshot.is_dynamic,
		memo: computed_loads
	});
}

function remember(revision: number, value: VoltageDrop[]): VoltageDrop[] {
	voltage_drop_result_reuse.revision = revision;
	voltage_drop_result_reuse.value = value;
	return value;
}

export function getComputedVoltageDrops(): VoltageDrop[] {
	const revision = getSnapshotRevision();
	if (voltage_drop_result_reuse.value && voltage_drop_result_reuse.revision === revision) {
		return voltage_drop_result_reuse.value;
	}
	return remember(revision, [...walk(loadSnapshot())]);
}

/**
 * The UI entry point. Walks the tree in slices of a few milliseconds and
 * yields between them, so a large project never blocks input or paint. A
 * write during the walk restarts it on the new revision; results are cached
 * per revision.
 */
export async function getComputedVoltageDropsAsync(): Promise<VoltageDrop[]> {
	for (;;) {
		const revision = getSnapshotRevision();
		if (voltage_drop_result_reuse.value && voltage_drop_result_reuse.revision === revision) {
			return voltage_drop_result_reuse.value;
		}
		const drops: VoltageDrop[] = [];
		let slice_start = performance.now();
		let stale = false;
		for (const drop of walk(peekSnapshot())) {
			drops.push(drop);
			if (performance.now() - slice_start < SLICE_MS) continue;
			await nextTask();
			if (getSnapshotRevision() !== revision) {
				stale = true;
				break;
			}
			slice_start = performance.now();
		}
		if (!stale) return remember(revision, drops);
	}
}
