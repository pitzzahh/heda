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

export interface FileEnvelopeV2 {
	v: 2;
	salt: string;
	payload: string;
}

export interface FileEnvelopeV3 {
	v: 3;
	payload: string;
}

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

// Overwrites written without truncate left the new envelope plus a stale tail
// of the old file. Only the first complete JSON value is read; GCM still
// authenticates the payload, so the ignored tail cannot forge content.
function envelopePrefix(raw: string): string {
	let depth = 0;
	let in_string = false;
	let escaped = false;
	for (let i = 0; i < raw.length; i++) {
		const char = raw[i];
		if (in_string) {
			if (escaped) escaped = false;
			else if (char === '\\') escaped = true;
			else if (char === '"') in_string = false;
		} else if (char === '"') in_string = true;
		else if (char === '{') depth++;
		else if (char === '}' && --depth === 0) return raw.slice(0, i + 1);
	}
	return raw;
}

// Garbage is unreadable too, but only legacy bytes deserve the legacy error.
export function detectFileVersion(raw: string): 1 | 2 | 3 {
	try {
		const envelope = JSON.parse(envelopePrefix(raw)) as Partial<FileEnvelopeV2 | FileEnvelopeV3>;
		if (envelope?.v === FILE_FORMAT_VERSION) return 2;
		if (envelope?.v === FILE_FORMAT_VERSION_DEVICE) return 3;
	} catch {
		// Not JSON: legacy bytes.
	}
	return 1;
}

export async function packFileV2<T>(data: T, password: string): Promise<string> {
	const salt = randomHex(16);
	const key = await deriveKey(password, salt, FILE_KEY_ITERATIONS);
	const envelope: FileEnvelopeV2 = {
		v: FILE_FORMAT_VERSION,
		salt,
		payload: await encryptGcm(JSON.stringify(data), key)
	};
	return JSON.stringify(envelope);
}

// v3: the raw device key is used directly, so open/save costs one AES-GCM
// pass and skips PBKDF2 entirely (milliseconds even on big files).
export async function packFileV3<T>(data: T, device_key: string): Promise<string> {
	const envelope: FileEnvelopeV3 = {
		v: FILE_FORMAT_VERSION_DEVICE,
		payload: await encryptGcm(JSON.stringify(data), deviceKeyBytes(device_key))
	};
	return JSON.stringify(envelope);
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
	device_key: string | null = null
): Promise<T> {
	const version = detectFileVersion(raw);
	if (version === 1) throw new FileLegacyError();
	if (version === 3) {
		if (!device_key) throw new FileDeviceKeyError();
		const envelope = JSON.parse(envelopePrefix(raw)) as FileEnvelopeV3;
		try {
			return JSON.parse(await decryptGcm(envelope.payload, deviceKeyBytes(device_key))) as T;
		} catch (err) {
			if (err instanceof FileDeviceKeyError) throw err;
			throw new FileDeviceKeyError();
		}
	}
	if (!password) throw new FilePasswordError('required');
	const envelope = JSON.parse(envelopePrefix(raw)) as FileEnvelopeV2;
	try {
		const key = await deriveKey(password, envelope.salt, FILE_KEY_ITERATIONS);
		return JSON.parse(await decryptGcm(envelope.payload, key)) as T;
	} catch {
		throw new FilePasswordError('invalid');
	}
}
