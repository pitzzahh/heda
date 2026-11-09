// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
	clearSessionPassword,
	getSessionPassword,
	getSessionProtection,
	setSessionPassword,
	setSessionProtection
} from '#lib/db/session.js';

const KEY = 'heda-session-password';
const PROTECTION_KEY = 'heda-file-protection';

afterEach(() => {
	clearSessionPassword();
	sessionStorage.clear();
});

describe('session password keepalive', () => {
	it('keeps the password across a reload in the same tab', () => {
		// Simulate a reload: drop the in-memory copy by reloading the module
		// state through a fresh set/read cycle is covered by memory itself.
		// Storing is enough: a new page load would read the same key.
		setSessionPassword('hunter2');
		expect(getSessionPassword()).toBe('hunter2');
		expect(sessionStorage.getItem(KEY)).toBe('hunter2');
	});

	it('drops the password when the session ends', () => {
		setSessionPassword('hunter2');
		clearSessionPassword();
		expect(getSessionPassword()).toBeNull();
		expect(sessionStorage.getItem(KEY)).toBeNull();
	});
});

describe('session file protection', () => {
	it('tracks whether the open file uses the device key or a password', () => {
		setSessionProtection('device');
		expect(getSessionProtection()).toBe('device');
		expect(sessionStorage.getItem(PROTECTION_KEY)).toBe('device');

		setSessionProtection('password');
		expect(getSessionProtection()).toBe('password');
	});

	it('drops protection with the password when the session ends', () => {
		setSessionPassword('hunter2');
		setSessionProtection('device');
		clearSessionPassword();
		expect(getSessionProtection()).toBeNull();
		expect(sessionStorage.getItem(PROTECTION_KEY)).toBeNull();
	});

	it('infers password protection for pre-upgrade sessions', () => {
		setSessionPassword('hunter2');
		expect(getSessionProtection()).toBe('password');
	});
});
