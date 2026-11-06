import { describe, expect, test } from 'vitest';
import { commandFrame } from './variants';

describe('commandFrame popup', () => {
	test('animates with keyframes like the dialog zoom motion', () => {
		const popup = commandFrame().popup();
		expect(popup).toContain('data-[state=open]:animate-in');
		expect(popup).toContain('data-[state=closed]:animate-out');
		expect(popup).toContain('data-[state=open]:fade-in-0');
		expect(popup).toContain('data-[state=open]:zoom-in-95');
		// Exit values must not be scoped to the close flip: WebKitGTK can resolve
		// keyframes from the pre-flip style when the animation starts in the same
		// recalc, which left the panel opaque on close.
		expect(popup).toContain('fade-out-0');
		expect(popup).not.toContain('data-[state=closed]:fade-out-0');
		expect(popup).toContain('zoom-out-95');
		expect(popup).not.toContain('data-[state=closed]:zoom-out-95');
	});

	test('centers with the translate property so keyframe transforms compose', () => {
		const popup = commandFrame().popup();
		expect(popup).toContain('-translate-x-1/2');
		expect(popup).not.toContain('transition-[');
		expect(popup).not.toContain('starting:');
		expect(popup).not.toContain('data-[closed]');
		expect(popup).not.toContain('data-[open]');
	});

	test('hides the mount frame bits-ui flags with data-starting-style', () => {
		expect(commandFrame().popup()).toContain('data-starting-style:opacity-0');
		// The bare bracket form compiles to a no-op `:is()` selector.
		expect(commandFrame().popup()).not.toContain('[data-starting-style]');
	});

	test('holds the exit state through the unmount gap', () => {
		expect(commandFrame().popup()).toContain('data-[state=closed]:fill-mode-forwards');
	});
});
