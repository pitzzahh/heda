// Reader for the legacy v1 `.heda` envelope. The CryptoJS-compatible decryption runs
// in the engine (`crates/heda-core/src/legacy_v1.rs`); it is only used for one-time
// migration, new files use the WebCrypto v2/v3 formats.
import { engine } from '#lib/core/api.js';

export interface LegacyV1Credentials {
	passphrase: string;
	salts: readonly string[];
}

export interface LegacyV1Result<T> {
	data: T;
	salt: string;
}

export type LegacyV1ErrorCode = 'format' | 'integrity' | 'ciphertext' | 'payload';

export class LegacyV1Error extends Error {
	code: LegacyV1ErrorCode;
	constructor(code: LegacyV1ErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

type LegacyV1Answer =
	{ text: string; salt: string } | { error: LegacyV1ErrorCode; message: string };

export function isLegacyV1Envelope(raw: string): Promise<boolean> {
	return engine<boolean>('is_legacy_v1', { raw });
}

export function legacyV1SaltCandidates(file_path: string, configured_salt: string): string[] {
	const file_name = file_path.replace(/\\/g, '/').split('/').pop() ?? file_path;
	const dot = file_name.lastIndexOf('.');
	const file_stem = dot > 0 ? file_name.slice(0, dot) : file_name;
	return [...new Set([configured_salt, file_stem].filter((salt) => salt.length > 0))];
}

export async function decryptLegacyV1<T>(
	raw: string,
	credentials: LegacyV1Credentials
): Promise<LegacyV1Result<T>> {
	const answer = await engine<LegacyV1Answer>('legacy_v1_decrypt', {
		raw,
		passphrase: credentials.passphrase,
		salts: credentials.salts
	});
	if ('error' in answer) throw new LegacyV1Error(answer.error, answer.message);
	try {
		// Parsed here, not in the engine, so the payload's numbers are exactly what JSON.parse gives.
		return { data: JSON.parse(answer.text) as T, salt: answer.salt };
	} catch {
		throw new LegacyV1Error('payload', 'The legacy file payload is not valid.');
	}
}
