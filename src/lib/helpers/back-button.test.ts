// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { closeTopLayer, hasOpenLayer, planBackAction } from './back-button.js';

const paths = { home_path: '/', workspace_path: '/workspace' };

describe('planBackAction', () => {
	test('closes an open layer first, wherever it is', () => {
		for (const pathname of ['/', '/workspace', '/workspace/load-schedule/root_1']) {
			expect(planBackAction({ ...paths, layer_open: true, pathname })).toBe('close_layer');
		}
	});

	test('exits from the home page', () => {
		expect(planBackAction({ ...paths, layer_open: false, pathname: '/' })).toBe('exit');
	});

	test('leaves the project from anywhere in the workspace', () => {
		for (const pathname of ['/workspace', '/workspace/load-schedule/transformer_root_1']) {
			expect(planBackAction({ ...paths, layer_open: false, pathname })).toBe('leave_project');
		}
	});

	test('goes home from any other page, like the error page', () => {
		for (const pathname of ['/missing', '/workspaces', '/workspace-old']) {
			expect(planBackAction({ ...paths, layer_open: false, pathname })).toBe('go_home');
		}
	});

	test('honors a base path', () => {
		const based = { home_path: '/heda/', workspace_path: '/heda/workspace' };
		expect(planBackAction({ ...based, layer_open: false, pathname: '/heda/' })).toBe('exit');
		expect(planBackAction({ ...based, layer_open: false, pathname: '/heda/workspace/x' })).toBe(
			'leave_project'
		);
	});
});

describe('hasOpenLayer', () => {
	afterEach(() => document.body.replaceChildren());

	const layer = (role: string, state: string) => {
		const element = document.createElement('div');
		element.setAttribute('role', role);
		element.dataset.state = state;
		document.body.append(element);
	};

	test('finds an open dialog, alert dialog, menu or select list', () => {
		for (const role of ['dialog', 'alertdialog', 'menu', 'listbox']) {
			document.body.replaceChildren();
			layer(role, 'open');
			expect(hasOpenLayer(document)).toBe(true);
		}
	});

	test('ignores closed layers, tooltips and open non-layers like a collapsible', () => {
		layer('dialog', 'closed');
		layer('tooltip', 'open');
		const collapsible = document.createElement('div');
		collapsible.dataset.state = 'open';
		document.body.append(collapsible);
		expect(hasOpenLayer(document)).toBe(false);
	});
});

describe('closeTopLayer', () => {
	test('sends the document the Escape keydown that bits-ui layers close on', () => {
		const keys: string[] = [];
		const listener = (event: KeyboardEvent) => keys.push(event.key);
		document.addEventListener('keydown', listener);
		closeTopLayer(document);
		document.removeEventListener('keydown', listener);
		expect(keys).toEqual(['Escape']);
	});
});
