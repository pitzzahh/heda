import { describe, expect, it } from 'vitest';
import { groupByDownstream } from './coordination-study.svelte';
import type { CoordinationPair } from '#lib/types/coordination.js';

const device = (id: string, at: number) => ({ id, name: id, at, af: 50 });
const pair = (up: string, down: string): CoordinationPair => ({
	system: 'emergency',
	section: '7.0.6.3',
	upstream: device(up, 100),
	downstream: device(down, 20),
	available_fault_current: 1000,
	status: { kind: 'needs_documentation' }
});

describe('groupByDownstream', () => {
	it("keeps each device's supply-side pairs together, in tree order", () => {
		const groups = groupByDownstream([pair('EP', 'e1'), pair('MDP', 'e1'), pair('EP', 'e2')]);
		expect(groups.map((g) => [g.downstream.id, g.pairs.map((p) => p.upstream.id)])).toEqual([
			['e1', ['EP', 'MDP']],
			['e2', ['EP']]
		]);
		expect(groupByDownstream([])).toEqual([]);
	});
});
