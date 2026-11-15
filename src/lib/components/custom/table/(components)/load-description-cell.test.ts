// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { updateLoadDescription, getNode } = vi.hoisted(() => ({
	updateLoadDescription: vi.fn(),
	getNode: vi.fn()
}));

vi.mock('#lib/db/mutations/index.js', () => ({ updateLoadDescription }));
vi.mock('#lib/db/queries/index.js', () => ({ getNode }));

import LoadDescriptionCellFixture, {
	get_fixture_state
} from './load-description-cell.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

function edit(value: string, key?: string) {
	const input = document.querySelector('input')!;
	input.focus();
	input.dispatchEvent(new FocusEvent('focus'));
	flushSync();
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	if (key) input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
	input.blur();
	input.dispatchEvent(new FocusEvent('blur'));
	flushSync();
	return input;
}

describe('LoadDescriptionCell', () => {
	test('saves a load rename, keeping the quantity prefix', () => {
		getNode.mockReturnValue({ id: 'node-a' });
		updateLoadDescription.mockReturnValue({ id: 'node-a' });
		const component = mount(LoadDescriptionCellFixture, {
			target: document.body,
			props: { node_type: 'load', load_description: '100 - Lighting' }
		});
		flushSync();

		edit('Kitchen lights');

		expect(updateLoadDescription).toHaveBeenCalledWith({
			node_id: 'node-a',
			load_description: '100 - Kitchen lights',
			node_type: 'load'
		});
		expect(get_fixture_state().hasUndoActions()).toBe(true);
		unmount(component);
	});

	test('saves a panel rename as the whole name', () => {
		getNode.mockReturnValue({ id: 'node-a' });
		updateLoadDescription.mockReturnValue({ id: 'node-a' });
		const component = mount(LoadDescriptionCellFixture, {
			target: document.body,
			props: { node_type: 'panel', load_description: 'LP-A' }
		});
		flushSync();

		edit('LP-B');

		expect(updateLoadDescription).toHaveBeenCalledWith({
			node_id: 'node-a',
			load_description: 'LP-B',
			node_type: 'panel'
		});
		unmount(component);
	});

	test('Escape and unchanged names save nothing', () => {
		const component = mount(LoadDescriptionCellFixture, {
			target: document.body,
			props: { node_type: 'load', load_description: '100 - Lighting' }
		});
		flushSync();

		expect(edit('Discarded', 'Escape').value).toBe('100 - Lighting');
		edit('Lighting');
		edit('   ');

		expect(updateLoadDescription).not.toHaveBeenCalled();
		unmount(component);
	});
});
