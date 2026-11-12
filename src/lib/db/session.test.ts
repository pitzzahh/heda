// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearSessionPassword,
	getSessionPassword,
	getSessionProtection,
	setSession,
	setSessionProtection
} from '#lib/db/session.js';

const KEY = 'heda-session';

/** A same-tab reload: module memory is gone, `sessionStorage` is not. */
async function reloadSessionModule() {
	vi.resetModules();
	return import('#lib/db/session.js');
}

afterEach(() => {
	clearSessionPassword();
	sessionStorage.clear();
});

describe('session keepalive', () => {
	it('keeps the secret and its protection across a reload in the same tab', async () => {
		setSession('device-key', 'device');
		expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual({
			secret: 'device-key',
			protection: 'device'
		});

		const reloaded = await reloadSessionModule();
		expect(reloaded.getSessionPassword()).toBe('device-key');
		expect(reloaded.getSessionProtection()).toBe('device');
	});

	it('drops the session, including entries from earlier builds, when it ends', () => {
		sessionStorage.setItem('heda-session-password', 'old');
		sessionStorage.setItem('heda-file-protection', 'password');
		setSession('hunter2', 'password');
		clearSessionPassword();
		expect(getSessionPassword()).toBeNull();
		expect(getSessionProtection()).toBeNull();
		expect(sessionStorage.length).toBe(0);
	});
});

describe('session file protection', () => {
	it('changes the protection mode without touching the secret', async () => {
		setSession('hunter2', 'password');
		setSessionProtection('device');
		expect(getSessionProtection()).toBe('device');

		const reloaded = await reloadSessionModule();
		expect(reloaded.getSessionPassword()).toBe('hunter2');
		expect(reloaded.getSessionProtection()).toBe('device');
	});

	it('does not guess a protection mode for an incomplete entry', async () => {
		sessionStorage.setItem(KEY, JSON.stringify({ secret: 'device-key' }));
		const reloaded = await reloadSessionModule();
		expect(reloaded.getSessionPassword()).toBeNull();
		expect(reloaded.getSessionProtection()).toBeNull();
	});
});
