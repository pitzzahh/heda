import { describe, expect, it } from 'vitest';
import type { RiserLayout } from '#lib/types/riser.js';
import { boxPath, visibleItems, wirePath } from './layout.js';

const box = (id: string, x: number) => ({
	id,
	x,
	y: 100,
	width: 240,
	height: 80,
	title: id,
	lines: []
});

/** Three panels a column (300 px) apart, as the engine lays them out. */
const layout: RiserLayout = {
	width: 1048,
	height: 400,
	boxes: [box('LP-1', 54), box('LP-2', 354), box('LP-3', 654)],
	wires: [],
	labels: [174, 474, 774].map((x, i) => ({ id: `LP-${i + 1}`, x: x + 16, y: 20, lines: ['CKT'] })),
	breakers: [174, 474, 774].map((x) => [x, 8] as [number, number]),
	ticks: [{ x: 174, y: 48, count: 2 }]
};

describe('visibleItems', () => {
	it('keeps only what lies in view, and everything without a view', () => {
		// The first column only.
		const shown = visibleItems(layout, { left: 0, top: 0, right: 300, bottom: 5000 });
		expect(shown.boxes.map((b) => b.id)).toEqual(['LP-1']);
		expect(shown.breakers).toEqual([[174, 8]]);
		expect(shown.ticks).toHaveLength(1);
		expect(visibleItems(layout)).toMatchObject({ boxes: layout.boxes, labels: layout.labels });
	});
});

describe('single-path drawing', () => {
	it('joins every wire and every box outline into one path each', () => {
		expect(
			wirePath([
				[
					[0, 0],
					[0, 10]
				],
				[
					[5, 5],
					[9, 5],
					[9, 8]
				]
			])
		).toBe('M0 0L0 10M5 5L9 5L9 8');
		expect(boxPath([{ id: 'a', x: 1, y: 2, width: 3, height: 4, title: '', lines: [] }])).toBe(
			'M1 2h3v4h-3Z'
		);
	});
});
