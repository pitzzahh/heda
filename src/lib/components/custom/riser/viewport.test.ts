import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM, fitView, visibleRect, zoomAt } from './viewport.js';

describe('zoomAt', () => {
	it('keeps the point under the cursor still', () => {
		const view = { x: 10, y: 20, k: 1 };
		const next = zoomAt(view, 2, 110, 70);
		// Content point under (110, 70): ((110 − 10) / 1, (70 − 20) / 1) = (100, 50).
		expect(next).toEqual({ k: 2, x: 110 - 100 * 2, y: 70 - 50 * 2 });
	});

	it('stays within the zoom limits', () => {
		expect(zoomAt({ x: 0, y: 0, k: 1 }, 100, 0, 0).k).toBe(MAX_ZOOM);
		expect(zoomAt({ x: 0, y: 0, k: 1 }, 0.001, 0, 0).k).toBe(MIN_ZOOM);
	});
});

describe('fitView', () => {
	it('shrinks a large diagram to the frame and centres it', () => {
		const view = fitView({ width: 2000, height: 500 }, { width: 1032, height: 800 });
		expect(view.k).toBe(0.5);
		expect(view.x).toBe((1032 - 1000) / 2);
		expect(view.y).toBe(16);
	});

	it('never enlarges a small diagram', () => {
		expect(fitView({ width: 100, height: 100 }, { width: 1000, height: 1000 }).k).toBe(1);
	});
});

describe('visibleRect', () => {
	it('maps the frame back to content coordinates, plus the overscan', () => {
		// Content moved 100 px left and 20 up at 50 %: screen 0…800 shows content 200…1800.
		expect(visibleRect({ x: -100, y: -20, k: 0.5 }, { width: 800, height: 600 }, 0)).toEqual({
			left: 200,
			top: 40,
			right: 1800,
			bottom: 1240
		});
		expect(visibleRect({ x: 0, y: 0, k: 1 }, { width: 800, height: 600 }, 50).left).toBe(-50);
	});

	it('fits a thousand-panel site (about 300 000 px) on screen', () => {
		expect(
			fitView({ width: 290_548, height: 960 }, { width: 1200, height: 700 }).k
		).toBeGreaterThan(MIN_ZOOM);
	});
});
