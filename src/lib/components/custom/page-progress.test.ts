// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import PageProgress from './page-progress.svelte';

// jsdom has no matchMedia; svelte/motion reads it (reduced-motion) at import, so the
// stub must run before the static component import below.
vi.hoisted(() => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			addEventListener: () => {},
			removeEventListener: () => {}
		})
	});
	// jsdom has no Web Animations; Svelte transitions call element.animate.
	Object.defineProperty(Element.prototype, 'animate', {
		configurable: true,
		writable: true,
		value: function () {
			const animation = {
				onfinish: null as (() => void) | null,
				finished: Promise.resolve(),
				cancel: () => {},
				play: () => {},
				pause: () => {},
				finish: () => {}
			};
			queueMicrotask(() => animation.onfinish?.());
			return animation;
		}
	});
});

const mocked = vi.hoisted(() => ({
	navigating: {
		type: null as string | null,
		to: null as string | null,
		from: null as string | null
	}
}));
vi.mock('$app/state', () => ({ navigating: mocked.navigating }));
vi.mock('$app/env', () => ({ browser: true }));

afterEach(() => {
	document.body.innerHTML = '';
	vi.useRealTimers();
});

// Regression: SvelteKit 3's `navigating` is an always-truthy object whose fields go
// null when idle. Checking the object itself left the bar stuck on every page.
describe('PageProgress', () => {
	test('stays hidden when no navigation is in flight', async () => {
		mocked.navigating.type = null;
		vi.useFakeTimers();
		const component = mount(PageProgress, { target: document.body });
		flushSync();
		await vi.advanceTimersByTimeAsync(5000);
		flushSync();
		expect(document.querySelector('progress')).toBeNull();
		unmount(component);
	});

	test('appears for a slow navigation', async () => {
		mocked.navigating.type = 'link';
		vi.useFakeTimers();
		const component = mount(PageProgress, { target: document.body });
		flushSync();
		expect(document.querySelector('progress')).toBeNull();
		await vi.advanceTimersByTimeAsync(2500);
		flushSync();
		expect(document.querySelector('progress')).not.toBeNull();
		unmount(component);
	});
});
