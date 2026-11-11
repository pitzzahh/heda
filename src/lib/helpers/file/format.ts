// One JSON envelope sealed with the file password (v2) or the device key
// (v3). Pure module: safe to unit test.
import {
	FILE_KEY_ITERATIONS,
	base64ToBytes,
	deriveKey,
	decryptGcm,
	encryptGcm,
	randomHex
} from '../security/index.js';

export const FILE_FORMAT_VERSION = 2;
export const FILE_FORMAT_VERSION_DEVICE = 3;

export class FilePasswordError extends Error {
	code: 'required' | 'invalid';
	constructor(code: 'required' | 'invalid') {
		super(code === 'required' ? 'Password required' : 'Invalid password');
		this.code = code;
	}
}

// v1 bytes are recognized but only the migration flow opens them.
export class FileLegacyError extends Error {
	constructor() {
		super('This file uses the legacy v1 format. Open it from the home page to upgrade it.');
	}
}

// A v3 file was made on another device (or the device key was lost). The
// payload is fine but holds no password to fall back to, so the message
// points at the real cause instead of a wrong "password".
export class FileDeviceKeyError extends Error {
	constructor() {
		super('This file was encrypted on another device. Open it on the device that created it.');
	}
}

/**
 * Reads a top-level string field without JSON.parsing the envelope. The writer
 * only stores base64 and hex here, neither of which can contain a quote, so
 * the first closing quote ends the value.
 */
function fieldValue(raw: string, field: string): string | null {
	const marker = `"${field}":"`;
	const start = raw.indexOf(marker);
	if (start === -1) return null;
	const from = start + marker.length;
	const end = raw.indexOf('"', from);
	return end === -1 ? null : raw.slice(from, end);
}

// Garbage is unreadable too, but only legacy bytes deserve the legacy error.
export function detectFileVersion(raw: string): 1 | 2 | 3 {
	// The writer starts every envelope with `{"v":N,`. Reading that prefix keeps
	// detection independent of the payload size: parsing the envelope would
	// duplicate the multi-megabyte base64 string just to read one digit.
	const match = /^\s*\{\s*"v"\s*:\s*([23])\s*[,}]/.exec(raw.slice(0, 64));
	if (match) return Number(match[1]) as 2 | 3;
	return 1;
}

export async function packFileV2<T>(data: T, password: string): Promise<string> {
	const salt = randomHex(16);
	const key = await deriveKey(password, salt, FILE_KEY_ITERATIONS);
	const payload = await encryptGcm(JSON.stringify(data), key);
	// Built by hand: salt and payload are JSON-safe (hex/base64), so stringifying
	// the envelope would only duplicate the whole payload string.
	return `{"v":${FILE_FORMAT_VERSION},"salt":"${salt}","payload":"${payload}"}`;
}

// v3: the raw device key is used directly, so open/save costs one AES-GCM
// pass and skips PBKDF2 entirely (milliseconds even on big files).
export async function packFileV3<T>(data: T, device_key: string): Promise<string> {
	const payload = await encryptGcm(JSON.stringify(data), deviceKeyBytes(device_key));
	return `{"v":${FILE_FORMAT_VERSION_DEVICE},"payload":"${payload}"}`;
}

function deviceKeyBytes(device_key: string): Uint8Array {
	let bytes: Uint8Array;
	try {
		bytes = base64ToBytes(device_key);
	} catch {
		throw new FileDeviceKeyError();
	}
	if (bytes.length !== 32) throw new FileDeviceKeyError();
	return bytes;
}

export async function decryptFilePayload<T>(
	raw: string,
	password: string | null,
	device_key: string | null = null,
	version: 1 | 2 | 3 = detectFileVersion(raw)
): Promise<T> {
	if (version === 1) throw new FileLegacyError();

	const payload = fieldValue(raw, 'payload');
	if (!payload) {
		// An envelope cut mid-payload is indistinguishable from legacy bytes.
		if (!raw.trimEnd().endsWith('}')) throw new FileLegacyError();
		throw version === 3 ? new FileDeviceKeyError() : new FilePasswordError('invalid');
	}

	if (version === 3) {
		if (!device_key) throw new FileDeviceKeyError();
		try {
			return JSON.parse(await decryptGcm(payload, deviceKeyBytes(device_key))) as T;
		} catch (err) {
			if (err instanceof FileDeviceKeyError) throw err;
			throw new FileDeviceKeyError();
		}
	}

	if (!password) throw new FilePasswordError('required');
	const salt = fieldValue(raw, 'salt');
	if (!salt) throw new FilePasswordError('invalid');

	try {
		const key = await deriveKey(password, salt, FILE_KEY_ITERATIONS);
		return JSON.parse(await decryptGcm(payload, key)) as T;
	} catch {
		throw new FilePasswordError('invalid');
	}
}
