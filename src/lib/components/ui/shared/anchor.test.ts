import { describe, expect, test } from 'vitest';
import { ANCHORED } from './anchor';

// Enter/exit must be keyframe animations (tw-animate-css), never @starting-style
// transitions: keyframes apply on the mount frame in every engine, so there is no
// first-frame flash of unpositioned content in webviews without @starting-style.
describe('ANCHORED', () => {
	test('animates with keyframes on both states', () => {
		expect(ANCHORED).toContain('data-[state=open]:animate-in');
		expect(ANCHORED).toContain('data-[state=closed]:animate-out');
		expect(ANCHORED).toContain('data-[state=open]:fade-in-0');
		expect(ANCHORED).toContain('data-[state=closed]:fade-out-0');
		expect(ANCHORED).toContain('data-[state=open]:zoom-in-95');
		expect(ANCHORED).toContain('data-[state=closed]:zoom-out-95');
	});

	test('leans toward the trigger per side', () => {
		expect(ANCHORED).toContain('data-[side=bottom]:slide-in-from-top-2');
		expect(ANCHORED).toContain('data-[side=top]:slide-in-from-bottom-2');
		expect(ANCHORED).toContain('data-[side=left]:slide-in-from-end-2');
		expect(ANCHORED).toContain('data-[side=right]:slide-in-from-start-2');
	});

	test('keeps the floating origin and motion tokens', () => {
		expect(ANCHORED).toContain('origin-(--bits-floating-transform-origin)');
		expect(ANCHORED).toContain('duration-[var(--duration-dropdown)]');
		expect(ANCHORED).toContain('duration-[var(--duration-exit)]');
		expect(ANCHORED).toContain('motion-reduce:animate-none');
	});

	test('uses no mount transitions', () => {
		expect(ANCHORED).not.toContain('starting:');
		expect(ANCHORED).not.toContain('transition-[');
	});
});
