import { describe, expect, test } from 'vitest';
import { commandFrame } from './variants';

describe('commandFrame popup', () => {
	test('animates like the dialog zoom motion', () => {
		const popup = commandFrame().popup();
		expect(popup).toContain('transition-[opacity,scale]');
		expect(popup).toContain('data-[state=closed]:opacity-0');
		expect(popup).toContain('data-[state=closed]:scale-[var(--popover-exit-scale)]');
		expect(popup).toContain('starting:data-[state=open]:opacity-0');
		expect(popup).toContain('starting:data-[state=open]:scale-[var(--modal-enter-scale)]');
		expect(popup).not.toContain('animate-in');
		expect(popup).not.toContain('animate-out');
	});

	test('keeps centering without mount guards', () => {
		const popup = commandFrame().popup();
		expect(popup).toContain('-translate-x-1/2');
		expect(popup).not.toContain('data-starting-style');
	});
});
