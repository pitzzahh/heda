// Session-only secrets. Plain module (no runes) so node tests can import it.
// The file password (or device key) lives here between unlock and close; it
// is never persisted. The secret is also mirrored to `sessionStorage`
// (same-tab, cleared when the tab closes) so a reload in the same window can
// re-unlock the session store instead of forcing a home + reload. Nothing is
// kept in `localStorage`.
//
// The secret and its protection mode are stored as one entry: written
// separately, a failed second write could leave a device-key session that
// reloads as a password session and saves an unopenable file.
const SESSION_KEY = 'heda-session';
// Written by earlier builds; only removed now.
const LEGACY_KEYS = ['heda-session-password', 'heda-file-protection'];

export type FileProtection = 'device' | 'password';

type StoredSession = { secret: string; protection: FileProtection };

function storage(): Storage | null {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		return null;
	}
}

let session: StoredSession | null = null;

function restore(): StoredSession | null {
	if (session) return session;
	try {
		const raw = storage()?.getItem(SESSION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<StoredSession>;
		if (
			typeof parsed.secret === 'string' &&
			parsed.secret &&
			(parsed.protection === 'device' || parsed.protection === 'password')
		) {
			session = { secret: parsed.secret, protection: parsed.protection };
		}
	} catch {
		// Unreadable storage or a malformed entry: treat the session as locked.
	}
	return session;
}

function persist(): void {
	try {
		if (session) storage()?.setItem(SESSION_KEY, JSON.stringify(session));
	} catch {
		// Storage can throw in private mode; memory still holds the session.
	}
}

/** Caches the unlock secret together with how the open file is sealed. */
export function setSession(secret: string, protection: FileProtection): void {
	session = { secret, protection };
	persist();
}

export function getSessionPassword(): string | null {
	return restore()?.secret ?? null;
}

export function getSessionProtection(): FileProtection | null {
	return restore()?.protection ?? null;
}

/** Changes the protection mode of the open session, keeping its secret. */
export function setSessionProtection(protection: FileProtection): void {
	const current = restore();
	if (!current) return;
	session = { ...current, protection };
	persist();
}

export function clearSessionPassword(): void {
	session = null;
	try {
		storage()?.removeItem(SESSION_KEY);
		for (const key of LEGACY_KEYS) storage()?.removeItem(key);
	} catch {
		// Nothing to clear if storage is unavailable.
	}
}
