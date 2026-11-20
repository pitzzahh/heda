// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { printableSvg } from './riser-svg.js';

describe('printableSvg', () => {
	it('prints black on white without theme classes', () => {
		const host = document.createElement('div');
		host.innerHTML =
			'<svg width="10" height="10" class="text-foreground"><rect class="fill-card" stroke="currentColor"/><text class="fill-muted-foreground">MDP</text></svg>';
		const svg = host.querySelector('svg')!;
		const out = printableSvg(svg);
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
		// The on-screen diagram is untouched.
		expect(svg.getAttribute('class')).toBe('text-foreground');
	});
});
