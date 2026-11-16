// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test } from 'vitest';
import TreeDragFixture from './tree-drag.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

/** Presses the row label and starts an HTML5 drag; true when sveltednd lets it start. */
function dragStarts(with_handle: boolean): boolean {
	const component = mount(TreeDragFixture, { target: document.body, props: { with_handle } });
	flushSync();
	const label = document.getElementById('label')!;
	label.dispatchEvent(new Event('pointerdown', { bubbles: true }));
	const drag = new Event('dragstart', { bubbles: true, cancelable: true });
	document.querySelector('[data-tree-drag]')!.dispatchEvent(drag);
	unmount(component);
	return !drag.defaultPrevented;
}

describe('sidebar tree rows', () => {
	test('sveltednd refuses a drag that starts inside a button without a handle', () => {
		expect(dragStarts(false)).toBe(false);
	});

	test('the row handle lets the drag start', () => {
		expect(dragStarts(true)).toBe(true);
	});
});
