import { describe, expect, test } from 'vitest';
import { sheet, type SheetSide } from './variants';

const SIDES: SheetSide[] = ['left', 'right', 'top', 'bottom'];

describe('sheet', () => {
	test('backdrop fades with keyframes', () => {
		const backdrop = sheet().backdrop();
		expect(backdrop).toContain('data-[state=open]:animate-in');
		expect(backdrop).toContain('data-[state=closed]:animate-out');
		expect(backdrop).toContain('data-[state=open]:fade-in-0');
		expect(backdrop).toContain('data-[state=closed]:fade-out-0');
		expect(backdrop).not.toContain('starting:');
	});

	test('panel slides with keyframes on every side', () => {
		for (const side of SIDES) {
			const panel = sheet({ side }).panel();
			expect(panel, side).toContain('data-[state=open]:animate-in');
			expect(panel, side).toContain('data-[state=closed]:animate-out');
			expect(panel, side).not.toContain('starting:');
			expect(panel, side).not.toContain('transition-[');
		}
	});

	test('each side slides the full panel off', () => {
		expect(sheet({ side: 'right' }).panel()).toContain('slide-in-from-right');
		expect(sheet({ side: 'right' }).panel()).toContain('slide-out-to-right');
		expect(sheet({ side: 'left' }).panel()).toContain('slide-in-from-left');
		expect(sheet({ side: 'left' }).panel()).toContain('slide-out-to-left');
		expect(sheet({ side: 'top' }).panel()).toContain('slide-in-from-top');
		expect(sheet({ side: 'top' }).panel()).toContain('slide-out-to-top');
		expect(sheet({ side: 'bottom' }).panel()).toContain('slide-in-from-bottom');
		expect(sheet({ side: 'bottom' }).panel()).toContain('slide-out-to-bottom');
	});

	test('hides the mount frame bits-ui flags with data-starting-style', () => {
		for (const side of SIDES) {
			const panel = sheet({ side }).panel();
			expect(panel, side).toContain('data-starting-style:opacity-0');
			// The bare bracket form compiles to a no-op `:is()` selector.
			expect(panel, side).not.toContain('[data-starting-style]');
		}
		expect(sheet().backdrop()).toContain('data-starting-style:opacity-0');
	});

	test('holds the exit state through the unmount gap', () => {
		for (const side of SIDES) {
			expect(sheet({ side }).panel(), side).toContain('data-[state=closed]:fill-mode-forwards');
		}
		expect(sheet().backdrop()).toContain('data-[state=closed]:fill-mode-forwards');
	});
});
