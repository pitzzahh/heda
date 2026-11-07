// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import StepperField from './stepper-field.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('StepperField', () => {
	test('renders the value with override tag and forwards clicks', () => {
		const on_decrement = vi.fn();
		const on_increment = vi.fn();
		const on_remove_override = vi.fn();
		const component = mount(StepperField, {
			target: document.body,
			props: {
				selected_value: '30',
				is_overridden: true,
				on_decrement,
				on_increment,
				on_remove_override
			}
		});
		flushSync();
		expect(document.body.textContent).toContain('30');
		expect(document.body.textContent).toContain('(Override)');

		const by_label = (label: string) => document.querySelector(`button[aria-label="${label}"]`);
		by_label('Decrease value')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		by_label('Increase value')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		document
			.querySelector('div.row-span-2 button')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();

		expect(on_decrement).toHaveBeenCalledOnce();
		expect(on_increment).toHaveBeenCalledOnce();
		expect(on_remove_override).toHaveBeenCalledOnce();
		unmount(component);
	});

	test('hides the override tag and remove button when not overridden', () => {
		const noop = () => {};
		const component = mount(StepperField, {
			target: document.body,
			props: {
				selected_value: '30',
				is_overridden: false,
				on_decrement: noop,
				on_increment: noop,
				on_remove_override: noop
			}
		});
		flushSync();
		expect(document.body.textContent).not.toContain('(Override)');
		expect(document.querySelector('div.row-span-2')).toBeNull();
		unmount(component);
	});
});
