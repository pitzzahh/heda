// One JSON envelope sealed with the file password. Pure module: safe to unit test.
import {
	FILE_KEY_ITERATIONS,
	deriveKey,
	decryptGcm,
	encryptGcm,
	randomHex
} from '../security/index.js';

export const FILE_FORMAT_VERSION = 2;

export interface FileEnvelopeV2 {
	v: 2;
	salt: string;
	payload: string;
}

export class FilePasswordError extends Error {
	code: 'required' | 'invalid';
	constructor(code: 'required' | 'invalid') {
		super(code === 'required' ? 'Password required' : 'Invalid password');
		this.code = code;
	}
}

// v1 bytes are recognized but never opened: CryptoJS-proprietary cipher.
export class FileLegacyError extends Error {
	constructor() {
		super('This file uses the legacy v1 format, which is no longer supported.');
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
export function detectFileVersion(raw: string): 1 | 2 {
	try {
		const envelope = JSON.parse(envelopePrefix(raw)) as Partial<FileEnvelopeV2>;
		if (envelope?.v === FILE_FORMAT_VERSION) return 2;
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

export async function decryptFilePayload<T>(raw: string, password: string | null): Promise<T> {
	if (detectFileVersion(raw) === 1) throw new FileLegacyError();
	if (!password) throw new FilePasswordError('required');
	const envelope = JSON.parse(envelopePrefix(raw)) as FileEnvelopeV2;
	try {
		const key = await deriveKey(password, envelope.salt, FILE_KEY_ITERATIONS);
		return JSON.parse(await decryptGcm(envelope.payload, key)) as T;
	} catch {
		throw new FilePasswordError('invalid');
	}
}
