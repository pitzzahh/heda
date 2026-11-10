import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WINDOW_CLOSE_REQUESTED, planWindowCloseAction } from './close-request.js';

describe('planWindowCloseAction', () => {
	const dirty = { has_unsaved_actions: true };

	it('closes straight through when no project is open', () => {
		expect(
			planWindowCloseAction({
				project_loaded: false,
				has_unsaved_actions: false,
				auto_save_enabled: false
			})
		).toBe('close');
		expect(
			planWindowCloseAction({ project_loaded: false, ...dirty, auto_save_enabled: false })
		).toBe('close');
	});

	it('closes without prompting when there are no unsaved actions', () => {
		expect(
			planWindowCloseAction({
				project_loaded: true,
				has_unsaved_actions: false,
				auto_save_enabled: false
			})
		).toBe('close');
		expect(
			planWindowCloseAction({
				project_loaded: true,
				has_unsaved_actions: false,
				auto_save_enabled: true
			})
		).toBe('close');
	});

	it('confirms the save when auto save is off and changes are pending', () => {
		expect(
			planWindowCloseAction({ project_loaded: true, ...dirty, auto_save_enabled: false })
		).toBe('confirm_save');
	});

	it('saves silently when auto save is on and changes are pending', () => {
		expect(planWindowCloseAction({ project_loaded: true, ...dirty, auto_save_enabled: true })).toBe(
			'save_then_close'
		);
	});
});

describe('WINDOW_CLOSE_REQUESTED contract with Rust', () => {
	it('matches the event name in src-tauri/src/lib.rs', () => {
		const rust = readFileSync(resolve(process.cwd(), 'src-tauri/src/lib.rs'), 'utf8');
		expect(rust).toContain(`const WINDOW_CLOSE_REQUESTED: &str = "${WINDOW_CLOSE_REQUESTED}"`);
	});

	it('registers the close_main_window command', () => {
		const rust = readFileSync(resolve(process.cwd(), 'src-tauri/src/lib.rs'), 'utf8');
		expect(rust).toContain('fn close_main_window');
		expect(rust).toContain('close_main_window');
	});
});
