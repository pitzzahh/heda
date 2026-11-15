// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';

const { installUpdate } = vi.hoisted(() => ({ installUpdate: vi.fn() }));
vi.mock('#lib/helpers/update/index.js', () => ({ checkForUpdates: vi.fn(), installUpdate }));
vi.mock('svelte-sonner', () => ({ toast: { warning: vi.fn(), info: vi.fn(), success: vi.fn() } }));

import UpdatesSection from './updates-section.svelte';

const MB = 1_048_576;

afterEach(() => {
	document.body.innerHTML = '';
	installUpdate.mockReset();
});

function start_install() {
	const component = mount(UpdatesSection, {
		target: document.body,
		props: { update_state: 'available', app_update: { version: '9.9.9' } as never }
	});
	flushSync();
	document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	flushSync();
	const report = installUpdate.mock.calls[0][2] as (bytes: number, total?: number) => void;
	return { component, report };
}

describe('UpdatesSection', () => {
	test('shows downloaded size and percent while the update downloads', () => {
		installUpdate.mockReturnValue(new Promise(() => {}));
		const { component, report } = start_install();

		report(8 * MB, 16 * MB);
		flushSync();
		expect(document.body.textContent).toContain('Downloading v9.9.9');
		expect(document.body.textContent).toContain('8.0 of 16.0 MB · 50%');
		expect(document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('50');

		report(16 * MB, 16 * MB);
		flushSync();
		expect(document.body.textContent).toContain('Installing v9.9.9');
		unmount(component);
	});

	test('shows only the downloaded size when the server sends none', () => {
		installUpdate.mockReturnValue(new Promise(() => {}));
		const { component, report } = start_install();

		report(4 * MB, undefined);
		flushSync();
		expect(document.body.textContent).toContain('4.0 MB');
		expect(document.body.textContent).not.toContain('NaN');
		unmount(component);
	});

	test('offers a retry when the install fails instead of hanging', async () => {
		installUpdate.mockRejectedValue(new Error('network down'));
		const { component } = start_install();

		await vi.waitFor(() => {
			flushSync();
			expect(document.body.textContent).toContain('Something went wrong. Try again');
		});
		expect(document.querySelector('[role=progressbar]')).toBeNull();
		unmount(component);
	});
});
