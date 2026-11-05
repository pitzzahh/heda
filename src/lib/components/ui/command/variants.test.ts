import { describe, expect, test } from 'vitest';
import { commandFrame } from './variants';

describe('commandFrame popup', () => {
	test('animates with keyframes like the dialog zoom motion', () => {
		const popup = commandFrame().popup();
		expect(popup).toContain('data-[state=open]:animate-in');
		expect(popup).toContain('data-[state=closed]:animate-out');
		expect(popup).toContain('data-[state=open]:fade-in-0');
		expect(popup).toContain('data-[state=closed]:fade-out-0');
		expect(popup).toContain('data-[state=open]:zoom-in-95');
		expect(popup).toContain('data-[state=closed]:zoom-out-95');
	});

	test('centers with the translate property so keyframe transforms compose', () => {
		const popup = commandFrame().popup();
		expect(popup).toContain('-translate-x-1/2');
		expect(popup).not.toContain('transition-[');
		expect(popup).not.toContain('starting:');
		expect(popup).not.toContain('data-[closed]');
		expect(popup).not.toContain('data-[open]');
	});
});
