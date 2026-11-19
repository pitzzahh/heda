// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { printableSvg, riserSvgText } from './riser-svg.js';
import type { RiserLayout } from '#lib/types/riser.js';

describe('printableSvg', () => {
	it('prints black on white without theme classes', () => {
		const host = document.createElement('div');
		host.innerHTML =
			'<svg class="text-foreground"><g data-viewport transform="translate(40 20) scale(0.5)"><rect class="fill-card" stroke="currentColor"/><text class="fill-muted-foreground">MDP</text></g></svg>';
		const svg = host.querySelector('svg')!;
		const out = printableSvg(svg, { width: 900, height: 400 });
		// Exactly one namespace declaration, or the file is not well-formed XML.
		expect(out.match(/xmlns=/g)).toHaveLength(1);
		expect(out).toContain('color="#000000"');
		expect(out).not.toContain('class=');
		const printed = new DOMParser().parseFromString(out, 'image/svg+xml').documentElement;
		expect(printed.querySelector('parsererror')).toBeNull();
		const [page, box] = printed.querySelectorAll('rect');
		// A white page behind everything, first.
		expect(page!.getAttribute('width')).toBe('100%');
		expect(page!.getAttribute('fill')).toBe('#ffffff');
		expect(box!.getAttribute('fill')).toBe('#ffffff');
		expect(box!.getAttribute('stroke')).toBe('currentColor');
		expect(printed.querySelector('text')!.getAttribute('fill')).toBe('#333333');
		// The whole diagram at 100 %, not the panned and zoomed view.
		expect(printed.getAttribute('viewBox')).toBe('0 0 900 400');
		expect(printed.getAttribute('width')).toBe('900');
		expect(printed.querySelector('g')!.hasAttribute('transform')).toBe(false);
		// The on-screen diagram is untouched.
		expect(svg.getAttribute('class')).toBe('text-foreground');
		expect(svg.querySelector('g')!.getAttribute('transform')).toBe('translate(40 20) scale(0.5)');
	});

	it('saves every panel, whatever the screen culled', () => {
		// Three panels across 10 000 px, far wider than any screen shows at once.
		const layout: RiserLayout = {
			width: 10_000,
			height: 400,
			boxes: ['MDP', 'LP-1', 'LP-2'].map((id, i) => ({
				id,
				x: i * 4_000,
				y: 100,
				width: 240,
				height: 80,
				title: id,
				lines: []
			})),
			wires: [],
			labels: [{ id: 'LP-2', x: 8_016, y: 20, lines: ['CKT 2: 60 AT / 60 AF, 2P'] }],
			breakers: [0, 4_000, 8_000].map((x) => [x, 8] as [number, number]),
			ticks: []
		};
		const printed = new DOMParser().parseFromString(riserSvgText(layout), 'image/svg+xml');
		expect(printed.querySelector('parsererror')).toBeNull();
		const titles = [...printed.querySelectorAll('text')].map((t) => t.textContent);
		expect(titles).toEqual(
			expect.arrayContaining(['MDP', 'LP-1', 'LP-2', 'CKT 2: 60 AT / 60 AF, 2P'])
		);
		// Breakers on all three feeders.
		expect(printed.querySelectorAll('use[href="#riser-breaker"]')).toHaveLength(3);
	});
});
