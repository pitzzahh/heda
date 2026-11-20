// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { printableSvg, riserSvgText } from './riser-svg.js';
import { layoutRiser } from '#lib/components/custom/riser/layout.js';
import type { PhaseLoadSchedule } from '#lib/types/schedule.js';

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
		const panel = (id: string) => ({
			row: { id, panel_data: { name: id }, at: 60 } as PhaseLoadSchedule,
			panels: [],
			branch_ats: [20]
		});
		const layout = layoutRiser({ ...panel('MDP'), panels: [panel('LP-1'), panel('LP-2')] });
		const printed = new DOMParser().parseFromString(riserSvgText(layout), 'image/svg+xml');
		expect(printed.querySelector('parsererror')).toBeNull();
		const titles = [...printed.querySelectorAll('text')].map((t) => t.textContent);
		expect(titles).toEqual(
			expect.arrayContaining(['MDP', 'LP-1', 'LP-2', 'CKT -: 60 AT / - AF, -P'])
		);
		// Breakers on all three feeders.
		expect(printed.querySelectorAll('use[href="#riser-breaker"]')).toHaveLength(3);
	});
});
