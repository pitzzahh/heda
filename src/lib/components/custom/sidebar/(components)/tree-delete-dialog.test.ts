// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { removeNode, toast } = vi.hoisted(() => ({
	removeNode: vi.fn(async () => 1),
	toast: { loading: vi.fn(() => 'toast-1'), success: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

vi.mock('#lib/db/mutations/index.js', () => ({
	removeNode,
	deleteProject: vi.fn()
}));

vi.mock('svelte-sonner', () => ({ toast }));

import DeleteDialogFixture from './tree-delete-dialog.fixture.svelte';

afterEach(() => {
	document.body.innerHTML = '';
	vi.clearAllMocks();
});

describe('TreeDeleteDialog', () => {
	test('confirm removes the node, then reports it', async () => {
		const component = mount(DeleteDialogFixture, { target: document.body });
		flushSync();
		const confirm = [...document.querySelectorAll('button')].find((element) =>
			element.textContent?.includes('Remove Load')
		);
		expect(confirm).not.toBeUndefined();
		confirm?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();
		expect(removeNode).toHaveBeenCalledWith('load-1');
		await vi.waitFor(() => expect(toast.success).toHaveBeenCalledOnce());
		unmount(component);
	});
});
