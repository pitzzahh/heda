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
	test('backdrop fades through a state transition', () => {
		const backdrop = dialogFrame().backdrop();
		expect(backdrop).toContain('opacity-0');
		expect(backdrop).toContain('data-[state=open]:opacity-100');
		expect(backdrop).toContain('transition-opacity');
		expect(backdrop).toContain('starting:data-[state=open]:opacity-0');
		// A full-viewport backdrop filter is the one genuinely expensive overlay effect.
		expect(backdrop).not.toContain('backdrop-blur');
	});

	test('every motion retraces itself', () => {
		for (const motion of MOTIONS) {
			const popup = dialogFrame({ motion }).popup();
			expect(popup, motion).toContain('transition-');
			expect(popup, motion).toContain('starting:data-[state=open]');
			expect(popup, motion).toContain('data-[state=closed]');
			expect(popup, motion).not.toContain('data-[closed]');
			expect(popup, motion).not.toContain('animate-in');
			expect(popup, motion).not.toContain('animate-out');
		}
	});

	test('zoom scales like upstream', () => {
		const popup = dialogFrame({ motion: 'zoom' }).popup();
		expect(popup).toContain('data-[state=closed]:[--dialog-scale:var(--modal-enter-scale)]');
		expect(popup).toContain('starting:data-[state=open]:[--dialog-scale:var(--modal-enter-scale)]');
	});

	test('slides retrace their direction', () => {
		expect(dialogFrame({ motion: 'slide-up' }).popup()).toContain(
			'data-[state=closed]:[--dialog-y:1.5rem]'
		);
		expect(dialogFrame({ motion: 'slide-down' }).popup()).toContain(
			'data-[state=closed]:[--dialog-y:-1.5rem]'
		);
		expect(dialogFrame({ motion: 'slide-left' }).popup()).toContain(
			'data-[state=closed]:[--dialog-x:1.5rem]'
		);
		expect(dialogFrame({ motion: 'slide-right' }).popup()).toContain(
			'data-[state=closed]:[--dialog-x:-1.5rem]'
		);
	});

	test('centers inside the transform var compose', () => {
		// Motion levers write transform vars; the -50% centering must compose with
		// them, never be hardcoded off or moved to a competing transform.
		const popup = dialogFrame({ motion: 'zoom' }).popup();
		expect(popup).toContain('translate(-50%,-50%)');
		expect(popup).toContain('var(--dialog-x,0)');
		expect(popup).toContain('var(--dialog-scale,1)');
	});

	test('uses only the data-state bits-ui emits', () => {
		for (const motion of MOTIONS) {
			const popup = dialogFrame({ motion }).popup();
			expect(popup, motion).not.toContain('data-[closed]');
			expect(popup, motion).not.toContain('data-[open]');
			expect(popup, motion).not.toContain('starting:data-[closed]');
			expect(popup, motion).not.toContain('starting:data-[open]');
		}
		expect(dialogFrame().backdrop()).not.toContain('data-[open]');
		expect(dialogFrame().backdrop()).not.toContain('data-[closed]');
	});
});
