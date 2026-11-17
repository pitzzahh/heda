import { afterEach, describe, expect, test, vi } from 'vitest';

import { isCompactViewport } from './platform.js';

describe('isCompactViewport', () => {
	afterEach(() => vi.unstubAllGlobals());

	const stubWidth = (width: number) =>
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches: width <= Number(/max-width: (\d+)px/.exec(query)?.[1])
		}));

	test('is true below lg (phones and tablets, where modals are drawers)', () => {
		stubWidth(384);
		expect(isCompactViewport()).toBe(true);
		stubWidth(1023);
		expect(isCompactViewport()).toBe(true);
	});

	test('is false from lg up, so desktop dialogs keep their autofocus', () => {
		stubWidth(1024);
		expect(isCompactViewport()).toBe(false);
	});

	test('is false without matchMedia (prerender, jsdom)', () => {
		vi.stubGlobal('matchMedia', undefined);
		expect(isCompactViewport()).toBe(false);
	});
});
