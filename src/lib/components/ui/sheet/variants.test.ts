import { describe, expect, test } from 'vitest';
import { sheet, type SheetSide } from './variants';

const SIDES: SheetSide[] = ['left', 'right', 'top', 'bottom'];

describe('sheet', () => {
	test('backdrop fades through a state transition', () => {
		const backdrop = sheet().backdrop();
		expect(backdrop).toContain('opacity-0');
		expect(backdrop).toContain('data-[state=open]:opacity-100');
		expect(backdrop).toContain('transition-opacity');
		expect(backdrop).toContain('starting:data-[state=open]:opacity-0');
		// A full-viewport backdrop filter is the one genuinely expensive overlay effect.
		expect(backdrop).not.toContain('backdrop-blur');
	});

	test('panel slides with a state transition on every side', () => {
		for (const side of SIDES) {
			const panel = sheet({ side }).panel();
			expect(panel, side).toContain('transition-transform');
			expect(panel, side).toContain(`starting:data-[state=open]:data-[side=${side}]`);
			expect(panel, side).not.toContain('animate-in');
			expect(panel, side).not.toContain('animate-out');
		}
	});

	test('each side slides the full panel off', () => {
		expect(sheet({ side: 'right' }).panel()).toContain(
			'data-[state=closed]:data-[side=right]:translate-x-full'
		);
		expect(sheet({ side: 'left' }).panel()).toContain(
			'data-[state=closed]:data-[side=left]:-translate-x-full'
		);
		expect(sheet({ side: 'top' }).panel()).toContain(
			'data-[state=closed]:data-[side=top]:-translate-y-full'
		);
		expect(sheet({ side: 'bottom' }).panel()).toContain(
			'data-[state=closed]:data-[side=bottom]:translate-y-full'
		);
	});
});
