import { setState, getState } from '#lib/state/index.svelte';
import { DB_REVISIONS_STATE_CTX } from '#lib/state/constants';

/**
 * Fine-grained invalidation counters.
 *
 * `workspace` covers project and hierarchy shape (sidebar, root node,
 * project title). `schedule` covers computed loads and voltage drops.
 * A field edit bumps only `schedule`; a structural edit bumps both.
 * Components read these with `$derived`, so an unrelated bump never
 * re-runs the other query. State reaches consumers through context,
 * never through a module global, so nothing leaks across users or
 * between server requests.
 */
export class DbRevisionsState {
	workspace = $state(0);
	schedule = $state(0);

	bumpWorkspace(): void {
		this.workspace += 1;
	}

	bumpSchedule(): void {
		this.schedule += 1;
	}

	bumpWorkspaceAndSchedule(): void {
		this.bumpWorkspace();
		this.bumpSchedule();
	}
}

export function setDbRevisionsState() {
	return setState(new DbRevisionsState(), DB_REVISIONS_STATE_CTX);
}

export function getDbRevisionsState() {
	return getState<DbRevisionsState>(DB_REVISIONS_STATE_CTX);
}
