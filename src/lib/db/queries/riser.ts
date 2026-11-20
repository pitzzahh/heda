import { getSnapshotRevision } from './snapshot.js';
import { settled } from '../index.js';
import { engine } from '#lib/core/api.js';
import type { RiserLayout } from '#lib/types/riser.js';

/** The riser diagram from `node_id` down, laid out by the engine; null for no such node. */
export async function getRiserAsync(node_id: string): Promise<RiserLayout | null> {
	for (;;) {
		// Pending writes answer first, so the revision read here is the one laid out.
		await settled();
		const revision = getSnapshotRevision();
		const layout = await engine<RiserLayout | null>('riser', { node_id });
		// A write meanwhile makes it stale; ask again on the new revision.
		if (getSnapshotRevision() === revision) return layout;
	}
}
