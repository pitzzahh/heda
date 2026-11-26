import { describe, expect, test, vi } from 'vitest';

vi.mock('#lib/db/mutations/index.js', () => ({ setSolarPv: vi.fn() }));
vi.mock('#lib/db/queries/index.js', () => ({ getAllChildNodes: () => [] }));

import { toStored } from './solar-pv-section.svelte';

const BUSBAR = { busbar_rating: 100, center_fed: true, engineered_busbar: true };

describe('toStored', () => {
	test('keeps the busbar choices on a back-fed panel', () => {
		expect(toStored({ panel: 'MDP', ...BUSBAR })).toEqual({ panel: 'MDP', ...BUSBAR });
	});

	test('drops the choices a connection hides, so none stay stored and uneditable', () => {
		// The connected panel was deleted: edit.rs drops only `panel`.
		expect(toStored({ on_feeder: true, ...BUSBAR })).toBeUndefined();
		expect(toStored({ supply_side: true, panel: 'MDP', on_feeder: true, ...BUSBAR })).toEqual({
			supply_side: true,
			panel: 'MDP'
		});
		expect(toStored({ panel: 'MDP', on_feeder: true, ...BUSBAR })).toEqual({
			panel: 'MDP',
			on_feeder: true
		});
	});
});
