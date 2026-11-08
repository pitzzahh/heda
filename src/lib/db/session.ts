// Session-only secrets. Plain module (no runes) so node tests can import it.
// The file password lives here between unlock and close; it is never persisted.
// The password is also mirrored to `sessionStorage` (same-tab, cleared when the
// tab closes) so a reload in the same window can re-unlock the session store
// instead of forcing a home + reload. Nothing is kept in `localStorage`.
const PASSWORD_KEY = 'heda-session-password';

function storage(): Storage | null {
	try {
		return typeof sessionStorage === 'undefined' ? null : sessionStorage;
	} catch {
		return null;
	}
}

let session_password: string | null = null;

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
	try {
		storage()?.removeItem(PASSWORD_KEY);
	} catch {
		// Nothing to clear if storage is unavailable.
	}
}
