import { afterEach, describe, expect, it, vi } from 'vitest';

const { error_log, log_write } = vi.hoisted(() => ({
	error_log: vi.fn(),
	// Plain holder, not a vi.fn: vitest attaches a handler to promises a mock returns,
	// which would hide the unhandled rejection the forwarding must prevent.
	log_write: { reject: false }
}));
vi.mock('@tauri-apps/plugin-log', () => ({
	trace: vi.fn().mockResolvedValue(undefined),
	debug: vi.fn().mockResolvedValue(undefined),
	info: vi.fn().mockResolvedValue(undefined),
	warn: vi.fn().mockResolvedValue(undefined),
	error: (message: string) => {
		error_log(message);
		return log_write.reject ? Promise.reject(new Error('no ipc')) : Promise.resolve();
	}
}));

import { forwardConsoleToLog, formatLogArg } from './index.js';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('forwardConsoleToLog', () => {
	it('keeps every argument and writes them all to the log', async () => {
		const original = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const restore = forwardConsoleToLog();

		const cause = new Error('disk full');
		console.error('Failed to remove nodes:', cause);
		restore();

		expect(original).toHaveBeenCalledWith('Failed to remove nodes:', cause);
		expect(error_log).toHaveBeenCalledWith(
			expect.stringContaining('Failed to remove nodes: Error: disk full')
		);
	});

	it('swallows a failed log write instead of rejecting', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		log_write.reject = true;
		const unhandled = vi.fn();
		process.on('unhandledRejection', unhandled);
		const restore = forwardConsoleToLog();

		console.error('boom');
		await new Promise((resolve) => setTimeout(resolve, 10));
		restore();
		process.off('unhandledRejection', unhandled);
		log_write.reject = false;

		expect(unhandled).not.toHaveBeenCalled();
	});

	it('restores the original console methods', () => {
		const before = console.warn;
		forwardConsoleToLog()();
		expect(console.warn).toBe(before);
	});
});

describe('formatLogArg', () => {
	it('formats objects and survives circular values', () => {
		expect(formatLogArg({ a: 1 })).toBe('{"a":1}');
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(formatLogArg(circular)).toBe('[object Object]');
		expect(formatLogArg(undefined)).toBe('undefined');
	});
});
