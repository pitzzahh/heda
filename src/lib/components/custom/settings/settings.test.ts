// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('svelte/motion', () => ({
	Tween: class {
		target: number;
		constructor(initial: number) {
			this.target = initial;
		}
	}
}));

vi.stubGlobal('matchMedia', () => ({
	matches: false,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

import SettingsFixture from './settings.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	localStorage.clear();
});

function click_label(label: string) {
	const target = [...document.querySelectorAll('a,button')].find((element) =>
		element.textContent?.includes(label)
	);
	target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	flushSync();
}

describe('Settings', () => {
	test('opens each section through the extracted components', () => {
		const component = mount(SettingsFixture, { target: document.body });
		flushSync();
		expect(document.body.textContent).not.toContain('Adjustment Factor');

		document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(document.body.textContent).toContain('Adjustment Factor');

		click_label('Preferences');
		expect(document.body.textContent).toContain('Theme');

		click_label('Updates');
		expect(document.body.textContent).toContain('App Version');
		unmount(component);
	});
});
