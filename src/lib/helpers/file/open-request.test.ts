import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FILE_OPEN_EVENT, planFileOpenAction } from './open-request.js';

describe('planFileOpenAction', () => {
	const dirty = { has_unsaved_actions: true };

	it('loads straight through when no project is open', () => {
		expect(
			planFileOpenAction({
				project_loaded: false,
				has_unsaved_actions: false,
				auto_save_enabled: false
			})
		).toBe('load');
		expect(planFileOpenAction({ project_loaded: false, ...dirty, auto_save_enabled: false })).toBe(
			'load'
		);
	});

	it('loads without prompting when there are no unsaved actions', () => {
		expect(
			planFileOpenAction({
				project_loaded: true,
				has_unsaved_actions: false,
				auto_save_enabled: false
			})
		).toBe('load');
		expect(
			planFileOpenAction({
				project_loaded: true,
				has_unsaved_actions: false,
				auto_save_enabled: true
			})
		).toBe('load');
	});

	it('confirms the save when auto save is off and changes are pending', () => {
		expect(planFileOpenAction({ project_loaded: true, ...dirty, auto_save_enabled: false })).toBe(
			'confirm_save'
		);
	});

	it('saves silently when auto save is on and changes are pending', () => {
		expect(planFileOpenAction({ project_loaded: true, ...dirty, auto_save_enabled: true })).toBe(
			'save_then_load'
		);
	});
});

describe('FILE_OPEN_EVENT contract with Rust', () => {
	it('matches the event name in src-tauri/src/lib.rs', () => {
		const rust = readFileSync(resolve(process.cwd(), 'src-tauri/src/lib.rs'), 'utf8');
		expect(rust).toContain(`const FILE_OPEN_EVENT: &str = "${FILE_OPEN_EVENT}"`);
	});
});
