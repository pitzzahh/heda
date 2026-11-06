import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

// The overlay enter/exit keyframes must stay off the `filter` property: WebKitGTK
// rasterizes animated filters in software every frame and the surfaces flicker.
// The keyframes are renamed (overlay-enter/overlay-exit) because Tailwind re-emits
// tw-animate-css's `enter`/`exit` keyframes after plain CSS, so same-name overrides
// lose the cascade no matter where in this file they sit.
const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

const keyframe = (name: string) => {
	const start = css.indexOf(`@keyframes ${name}`);
	if (start === -1) return '';
	let depth = 0;
	for (let i = start; i < css.length; i += 1) {
		if (css[i] === '{') depth += 1;
		else if (css[i] === '}') {
			depth -= 1;
			if (depth === 0) return css.slice(start, i + 1);
		}
	}
	return css.slice(start);
};

describe('overlay animation keyframes', () => {
	test('enter and exit never animate filter', () => {
		expect(keyframe('overlay-enter')).not.toBe('');
		expect(keyframe('overlay-exit')).not.toBe('');
		expect(keyframe('overlay-enter')).not.toContain('filter');
		expect(keyframe('overlay-exit')).not.toContain('filter');
	});

	test('the animate utilities point at the renamed keyframes', () => {
		expect(css).toContain('--animate-in: overlay-enter');
		expect(css).toContain('--animate-out: overlay-exit');
	});

	test('no same-name override of the tw-animate keyframes', () => {
		expect(css).not.toContain('@keyframes enter');
		expect(css).not.toContain('@keyframes exit');
	});
});
