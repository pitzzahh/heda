// PBKDF2 iteration count for file passwords.
export const FILE_KEY_ITERATIONS = 100_000;

export function randomHex(bytes: number = 16): string {
	return bytesToHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Chunked so multi-megabyte project files don't blow the call stack.
function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
	const binary = atob(base64);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
	return out;
}

// PBKDF2-SHA256 -> 32 raw key bytes. Memoized: autosave re-derives the same
// key every tick, and the KDF is the slowest step by far.
const derived_cache = new Map<string, Promise<Uint8Array>>();

export function deriveKey(
	passphrase: string,
	salt_hex: string,
	iterations: number
): Promise<Uint8Array> {
	const cache_key = `${iterations}:${salt_hex}:${passphrase}`;
	const cached = derived_cache.get(cache_key);
	if (cached) return cached;
	if (derived_cache.size > 16) derived_cache.clear();
	const derived = (async () => {
		const base = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(passphrase),
			'PBKDF2',
			false,
			['deriveBits']
		);
		const bits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				hash: 'SHA-256',
				salt: hexToBytes(salt_hex) as BufferSource,
				iterations
			},
			base,
			256
		);
		return new Uint8Array(bits);
	})();
	derived_cache.set(cache_key, derived);
	return derived;
}

// AES-256-GCM with a random 12-byte nonce per call. Packed form is
// "nonce_b64:ciphertext_b64" (auth tag included in the ciphertext).
export async function encryptGcm(plaintext: string, key: Uint8Array): Promise<string> {
	const nonce = crypto.getRandomValues(new Uint8Array(12));
	const crypto_key = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, [
		'encrypt'
	]);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv: nonce as BufferSource },
		crypto_key,
		new TextEncoder().encode(plaintext)
	);
	return `${bytesToBase64(nonce)}:${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptGcm(packed: string, key: Uint8Array): Promise<string> {
	const separator = packed.indexOf(':');
	if (separator === -1) throw new Error('Invalid encrypted data format');
	try {
		const crypto_key = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, [
			'decrypt'
		]);
		const plaintext = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: base64ToBytes(packed.slice(0, separator)) as BufferSource },
			crypto_key,
			base64ToBytes(packed.slice(separator + 1)) as BufferSource
		);
		return new TextDecoder().decode(plaintext);
	} catch {
		throw new Error('Decryption failed');
	}
}

// Raw session-store key from the Stronghold passphrase (already 32 uniform
// random bytes, base64). No KDF needed: only files stretch user passwords.
export function sessionStoreKey(passphrase: string): Uint8Array {
	return base64ToBytes(passphrase);
}
