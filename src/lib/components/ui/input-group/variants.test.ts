import { describe, expect, it } from 'vitest';
import { inputGroupAddon } from './variants.js';

const classes = (align: 'inline-start' | 'inline-end' | 'block-start' | 'block-end') =>
	inputGroupAddon({ align }).split(/\s+/);

// Jsdom has no layout, so these pin the classes that keep an addon inside its group: any
// overflow made the drawers it sits in scroll and show a scrollbar (#368).
describe('inputGroupAddon', () => {
	it.each(['inline-start', 'inline-end'] as const)(
		'%s takes the group height and never sticks out past its border',
		(align) => {
			const list = classes(align);
			expect(list).toContain('self-stretch');
			expect(list.filter((c) => /^(py|pt|pb)-/.test(c))).toEqual([]);
			expect(list.filter((c) => /(^|:)-m[lrx]-/.test(c))).toEqual([]);
		}
	);

	it('keeps the vertical padding of block addons', () => {
		expect(classes('block-start')).toEqual(expect.arrayContaining(['pt-3', 'pb-1.5']));
		expect(classes('block-end')).toEqual(expect.arrayContaining(['pt-1.5', 'pb-3']));
	});
});
