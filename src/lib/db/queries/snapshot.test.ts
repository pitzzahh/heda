// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	STANDARD_TERMINAL_TEMPERATURE,
	default_load_types,
	default_phases
} from '#lib/constants/index.js';
import { initializeDatabase } from '#lib/db/index.js';
import { addNode, createProject, overrideField, resetData } from '#lib/db/mutations/index.js';
import { getComputedLoads } from '#lib/db/queries/index.js';
import SnapshotFixture from '#lib/db/queries/snapshot-fixture.svelte';

beforeAll(async () => {
	await initializeDatabase();
});

describe('load snapshot reactivity', () => {
	it('keeps a mounted derived fresh after an outside read primes the cache', async () => {
		resetData();
		const created = await createProject('Snapshot', {
			distribution_unit: 'Transformer',
			phase: default_phases.ONE_PHASE
		});
		const root = created!.root_node_id;
		const panel = addNode({
			parent_id: root,
			panel_data: {
				name: 'LP-A',
				circuit_number: 1,
				ambient_temperature: 30,
				length: 10,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				phase: default_phases.ONE_PHASE
			}
		});
		const load = addNode({
			parent_id: panel!.id,
			load_data: {
				load_type: default_load_types.GENERAL_LIGHTING,
				quantity: 100,
				varies: '0',
				load_description: '100 - Lighting',
				continuous: false,
				circuit_number: 1,
				length: 10,
				ambient_temperature: 30,
				terminal_temperature: STANDARD_TERMINAL_TEMPERATURE,
				config_preference: 'CUSTOM'
			} as const
		});

		// A read outside any `$derived` (warmup, handler) primes the cache.
		// The mounted derived afterwards must still stay subscribed.
		expect(getComputedLoads(panel!.id)[0]?.at).toBe(15);

		const app = mount(SnapshotFixture, {
			target: document.body,
			props: { node_id: panel!.id }
		});
		flushSync();
		expect(document.body.textContent).toContain('at:15');

		flushSync(() => {
			overrideField({ node_id: load!.id, field_data: 50, field_type: 'at' });
		});
		expect(document.body.textContent).toContain('at:50');
		unmount(app);
		document.body.innerHTML = '';
	});
});
