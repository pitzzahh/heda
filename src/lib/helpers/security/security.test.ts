import { describe, expect, it } from 'vitest';
import {
	base64ToBytes,
	bytesToBase64,
	bytesToHex,
	decryptGcm,
	deriveKey,
	encryptGcm,
	randomHex
} from './index.js';

const SALT = '00112233445566778899aabbccddeeff';
const PASSPHRASE = 'test-passphrase';
// Pinned PBKDF2-SHA256 vector (1000 iterations) for the pair above.
const KEY = '818b38756d5aaa7bd0fc4d3369d34f931c30a43c41dc325cbbe791a2d1bf2abd';

describe('webcrypto primitives', () => {
	it('derives the known PBKDF2 key', async () => {
		await expect(deriveKey(PASSPHRASE, SALT, 1000).then(bytesToHex)).resolves.toBe(KEY);
	});

	it('round-trips AES-GCM', async () => {
		const key = await deriveKey('pw', randomHex(16), 1000);
		const packed = await encryptGcm('{"hello":"world"}', key);
		await expect(decryptGcm(packed, key)).resolves.toBe('{"hello":"world"}');
	});

	it('rejects AES-GCM with the wrong key', async () => {
		const key = await deriveKey('pw', randomHex(16), 1000);
		const packed = await encryptGcm('secret', key);
		const wrong = await deriveKey('wrong', randomHex(16), 1000);
		await expect(decryptGcm(packed, wrong)).rejects.toThrow();
	});

	it('rejects tampered AES-GCM payloads', async () => {
		const key = await deriveKey('pw', randomHex(16), 1000);
		const [nonce, cipher] = (await encryptGcm('secret', key)).split(':');
		await expect(decryptGcm(`${nonce}:${cipher.slice(0, -4)}AAAA`, key)).rejects.toThrow();
	});

	it('generates hex salts', () => {
		expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/);
	});
});

describe('base64', () => {
	const bytes = Uint8Array.from({ length: 0x8000 + 17 }, (_, index) => index % 256);

	it('uses the standard alphabet', () => {
		expect(bytesToBase64(Uint8Array.from([0, 1, 2, 250]))).toBe('AAEC+g==');
	});

	it('round-trips across chunk boundaries', () => {
		const encoded = bytesToBase64(bytes);
		expect(base64ToBytes(encoded)).toEqual(bytes);
	});

	it('round-trips without the native helpers', () => {
		const to_base64 = Object.getOwnPropertyDescriptor(Uint8Array.prototype, 'toBase64');
		const from_base64 = Object.getOwnPropertyDescriptor(Uint8Array, 'fromBase64');
		try {
			delete (Uint8Array.prototype as { toBase64?: unknown }).toBase64;
			delete (Uint8Array as { fromBase64?: unknown }).fromBase64;

			expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
		} finally {
			if (to_base64) Object.defineProperty(Uint8Array.prototype, 'toBase64', to_base64);
			if (from_base64) Object.defineProperty(Uint8Array, 'fromBase64', from_base64);
		}
	});
});
