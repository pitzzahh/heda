// Session-only secrets. Plain module (no runes) so node tests can import it.
// The file password lives here between unlock and close; it is never persisted.
let session_password: string | null = null;

export function setSessionPassword(password: string): void {
	session_password = password;
}

export function getSessionPassword(): string | null {
	return session_password;
}

export function clearSessionPassword(): void {
	session_password = null;
}
