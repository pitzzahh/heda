// .heda file format. Every file is one JSON envelope sealed with the file
// password (PBKDF2 100k + AES-256-GCM, random salt per file). Pure module: no
// Tauri, no toasts, so it's safe to unit test.
import { FILE_KEY_ITERATIONS, deriveKey, decryptGcm, encryptGcm, randomHex } from '../security';

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

// v1 files (pre-envelope `h:c:s` bytes, or anything unparseable) can be
// recognized but no longer opened: their cipher is CryptoJS-proprietary.
export class FileLegacyError extends Error {
	constructor() {
		super('This file uses the legacy v1 format, which is no longer supported.');
	}
}

// 2 for a v2 envelope, else 1. Legacy bytes and garbage are both unreadable
// without v1 support, but only legacy bytes deserve the legacy error.
export function detectFileVersion(raw: string): 1 | 2 {
	try {
		const envelope = JSON.parse(raw) as Partial<FileEnvelopeV2>;
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
	const envelope = JSON.parse(raw) as FileEnvelopeV2;
	try {
		const key = await deriveKey(password, envelope.salt, FILE_KEY_ITERATIONS);
		return JSON.parse(await decryptGcm(envelope.payload, key)) as T;
	} catch {
		throw new FilePasswordError('invalid');
	}
}
