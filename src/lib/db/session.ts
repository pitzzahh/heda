// Session-only secrets. Plain module (no runes) so node tests can import it.
// The file password (or device key) lives here between unlock and close; it
// is never persisted. The secret is also mirrored to `sessionStorage`
// (same-tab, cleared when the tab closes) so a reload in the same window can
// re-unlock the session store instead of forcing a home + reload. Nothing is
// kept in `localStorage`.
const PASSWORD_KEY = 'heda-session-password';
const PROTECTION_KEY = 'heda-file-protection';

export type FileProtection = 'device' | 'password';

function storage(): Storage | null {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		return null;
	}
}

let session_password: string | null = null;
let file_protection: FileProtection | null = null;

export function setSessionPassword(password: string): void {
	session_password = password;
	try {
		storage()?.setItem(PASSWORD_KEY, password);
	} catch {
		// Storage can throw in private mode; memory still holds the session.
	}
}

export function getSessionPassword(): string | null {
	if (session_password) return session_password;
	try {
		const stored = storage()?.getItem(PASSWORD_KEY) ?? null;
		if (stored) session_password = stored;
		return session_password;
	} catch {
		return null;
	}
}

export function clearSessionPassword(): void {
	session_password = null;
	file_protection = null;
	try {
		storage()?.removeItem(PASSWORD_KEY);
		storage()?.removeItem(PROTECTION_KEY);
	} catch {
		// Nothing to clear if storage is unavailable.
	}
}

export function setSessionProtection(protection: FileProtection): void {
	file_protection = protection;
	try {
		storage()?.setItem(PROTECTION_KEY, protection);
	} catch {
		// Storage can throw in private mode; memory still holds the session.
	}
}

export function getSessionProtection(): FileProtection | null {
	if (file_protection) return file_protection;
	try {
		const stored = storage()?.getItem(PROTECTION_KEY);
		if (stored === 'device' || stored === 'password') {
			file_protection = stored;
			return file_protection;
		}
		if (stored === null && getSessionPassword()) return 'password';
		return null;
	} catch {
		return getSessionPassword() ? 'password' : null;
	}
}
