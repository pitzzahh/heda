import { getSnapshotRevision } from './snapshot.js';
import { settled } from '../index.js';
import { engine } from '#lib/core/api.js';
import type { CoordinationPair } from '#lib/types/coordination.js';

/** The device pairs PEC 2017 requires to be selectively coordinated, from the engine. */
export async function getCoordinationAsync(): Promise<CoordinationPair[]> {
	for (;;) {
		// Pending writes answer first, so the revision read here is the one studied.
		await settled();
		const revision = getSnapshotRevision();
		const pairs = await engine<CoordinationPair[]>('coordination');
		// A write meanwhile makes it stale; ask again on the new revision.
		if (getSnapshotRevision() === revision) return pairs;
	}
}
