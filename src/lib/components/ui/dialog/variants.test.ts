import { describe, expect, test } from 'vitest';
import { dialogFrame, type DialogMotion } from './variants';

const MOTIONS: DialogMotion[] = [
	'zoom',
	'fade',
	'slide-up',
	'slide-down',
	'slide-left',
	'slide-right',
	'morph'
];

describe('dialogFrame', () => {
	test('backdrop fades with keyframes', () => {
		const backdrop = dialogFrame().backdrop();
		expect(backdrop).toContain('data-[state=open]:animate-in');
		expect(backdrop).toContain('data-[state=closed]:animate-out');
		expect(backdrop).toContain('data-[state=open]:fade-in-0');
		expect(backdrop).toContain('data-[state=closed]:fade-out-0');
		expect(backdrop).not.toContain('starting:');
	});

	test('every motion animates both ways', () => {
		for (const motion of MOTIONS) {
			const popup = dialogFrame({ motion }).popup();
			expect(popup, motion).toContain('data-[state=open]:animate-in');
			expect(popup, motion).toContain('data-[state=closed]:animate-out');
			expect(popup, motion).toContain('data-[state=open]:fade-in-0');
			expect(popup, motion).toContain('data-[state=closed]:fade-out-0');
		}
	});

	test('zoom scales like upstream', () => {
		const popup = dialogFrame({ motion: 'zoom' }).popup();
		expect(popup).toContain('data-[state=open]:zoom-in-95');
		expect(popup).toContain('data-[state=closed]:zoom-out-95');
	});

	test('slides retrace their direction', () => {
		expect(dialogFrame({ motion: 'slide-up' }).popup()).toContain('slide-in-from-bottom-6');
		expect(dialogFrame({ motion: 'slide-down' }).popup()).toContain('slide-in-from-top-6');
		expect(dialogFrame({ motion: 'slide-left' }).popup()).toContain('slide-in-from-end-6');
		expect(dialogFrame({ motion: 'slide-right' }).popup()).toContain('slide-in-from-start-6');
	});

	test('centers with the translate property so keyframe transforms compose', () => {
		// tw-animate keyframes write `transform`; the -50% centering must live on the
		// separate `translate` property (Tailwind v4 translate-*), never in `transform`.
		const popup = dialogFrame({ motion: 'zoom' }).popup();
		expect(popup).toContain('-translate-x-1/2');
		expect(popup).toContain('-translate-y-1/2');
		expect(popup).not.toContain('translate(-50%,-50%)');
		expect(popup).not.toContain('--dialog-');
	});

	test('uses only the data-state bits-ui emits', () => {
		for (const motion of MOTIONS) {
			const popup = dialogFrame({ motion }).popup();
			expect(popup, motion).not.toContain('data-[closed]');
			expect(popup, motion).not.toContain('starting:');
		}
		expect(dialogFrame().backdrop()).not.toContain('data-[open]');
	});
});
