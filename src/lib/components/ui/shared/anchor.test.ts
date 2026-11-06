import { describe, expect, test } from 'vitest';
import { ANCHORED } from './anchor';

// Motion is plain state transitions, never keyframes or animation custom properties:
// WebKitGTK resolved keyframe custom properties from the pre-flip style and closed
// surfaces without fading.
describe('ANCHORED', () => {
	test('fades through state transitions', () => {
		expect(ANCHORED).toContain('opacity-0');
		expect(ANCHORED).toContain('data-[state=open]:opacity-100');
		expect(ANCHORED).toContain('transition-[opacity,scale,translate]');
		expect(ANCHORED).toContain('duration-[var(--duration-dropdown)]');
		expect(ANCHORED).toContain('duration-[var(--duration-exit)]');
	});

	test('animates the first open frame', () => {
		expect(ANCHORED).toContain('starting:data-[state=open]:opacity-0');
	});

	test('leans toward the trigger per side', () => {
		expect(ANCHORED).toContain('data-[state=closed]:data-[side=bottom]:-translate-y-1');
		expect(ANCHORED).toContain('data-[state=closed]:data-[side=top]:translate-y-1');
		expect(ANCHORED).toContain('data-[state=closed]:data-[side=left]:translate-x-1');
		expect(ANCHORED).toContain('data-[state=closed]:data-[side=right]:-translate-x-1');
	});

	test('keeps the floating origin and motion tokens', () => {
		expect(ANCHORED).toContain('origin-(--bits-floating-transform-origin)');
		expect(ANCHORED).toContain('scale-[var(--popover-exit-scale)]');
		expect(ANCHORED).toContain('starting:data-[state=open]:scale-[var(--popover-enter-scale)]');
		expect(ANCHORED).toContain('motion-reduce:transition-none');
	});

	test('uses no keyframe machinery', () => {
		expect(ANCHORED).not.toContain('animate-in');
		expect(ANCHORED).not.toContain('animate-out');
		expect(ANCHORED).not.toContain('fill-mode-forwards');
	});
});
