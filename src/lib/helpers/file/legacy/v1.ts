// CryptoJS-compatible reader for the legacy v1 `.heda` envelope.
//
// v1 sealed files with CryptoJS AES-CBC and HMAC-SHA256. Its PBKDF2 accepted
// `Hex.parse` of non-hex salts (fractional sigBytes) and its AES key was the
// 64-character hex string itself, which selects a 512-bit, 22-round schedule.
// WebCrypto cannot reproduce those quirks, so this module ports the exact
// CryptoJS behaviour. It is only used for one-time migration; new files use
// the WebCrypto v2 format.

export const LEGACY_V1_ITERATIONS = 1000;

const LEGACY_V1_KEY_BYTES = 32;

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

// v1 releases before 1.6 replaced these base64 characters with symbols.
const GIBBERISH_TO_BASE64: Record<string, string> = {
	'♜': 'a',
	'♞': 'B',
	'♝': 'c',
	'♛': 'D',
	'♚': 'e',
	'♟': 'F',
	'♖': 'g',
	'♘': 'H',
	'♗': 'i',
	'♕': 'J',
	'♔': 'k',
	'♙': 'L',
	'♠': 'm',
	'♣': 'N',
	'♥': 'o',
	'♦': 'P',
	'♪': 'q',
	'♫': 'R',
	'☼': 's',
	'☾': 'T',
	'☁': 'u',
	'☂': 'V',
	'☃': 'w',
	'✘': 'X',
	'✔': 'y',
	'✦': 'Z',
	'⓪': '0',
	'②': '2',
	'④': '4',
	'⑥': '6',
	'⑧': '8'
};

interface WordArray {
	words: number[];
	sigBytes: number;
}

interface LegacyV1Envelope {
	iv: Uint8Array;
	hmac: Uint8Array;
	cipher: Uint8Array;
	iv_base64: string;
	cipher_base64: string;
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function normalizeGibberish(value: string): string {
	let normalized = '';
	for (const char of value) normalized += GIBBERISH_TO_BASE64[char] ?? char;
	return normalized;
}

function base64ToBytes(value: string): Uint8Array {
	if (!BASE64_PATTERN.test(value)) {
		throw new LegacyV1Error('format', 'The legacy file envelope is not valid.');
	}
	try {
		const binary = atob(value);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		throw new LegacyV1Error('format', 'The legacy file envelope is not valid.');
	}
}

function decodeEnvelope(raw: string): LegacyV1Envelope {
	const parts = normalizeGibberish(raw.trim()).split(':');
	if (parts.length < 3) {
		throw new LegacyV1Error('format', 'The legacy file envelope is not valid.');
	}
	// Older writes did not truncate, so only the first envelope counts.
	const [iv_base64, hmac_base64, cipher_base64] = parts;
	const iv = base64ToBytes(iv_base64);
	const hmac = base64ToBytes(hmac_base64);
	const cipher = base64ToBytes(cipher_base64);
	if (iv.length !== 16 || hmac.length !== 32 || cipher.length === 0 || cipher.length % 16) {
		throw new LegacyV1Error('format', 'The legacy file envelope is not valid.');
	}
	return { iv, hmac, cipher, iv_base64, cipher_base64 };
}

export function isLegacyV1Envelope(raw: string): boolean {
	try {
		decodeEnvelope(raw);
		return true;
	} catch {
		return false;
	}
}

export function legacyV1SaltCandidates(file_path: string, configured_salt: string): string[] {
	const file_name = file_path.replace(/\\/g, '/').split('/').pop() ?? file_path;
	const dot = file_name.lastIndexOf('.');
	const file_stem = dot > 0 ? file_name.slice(0, dot) : file_name;
	return [...new Set([configured_salt, file_stem].filter((salt) => salt.length > 0))];
}

/* CryptoJS WordArray helpers, not general-purpose hash primitives. */

function clampWords(words: number[], sig_bytes: number): void {
	const index = sig_bytes >>> 2;
	words[index] = (words[index] ?? 0) & (0xffffffff << (32 - (sig_bytes % 4) * 8));
	words.length = Math.ceil(sig_bytes / 4);
}

function concatWords(left: WordArray, right: WordArray): WordArray {
	const words = left.words.slice();
	clampWords(words, left.sigBytes);
	if (left.sigBytes % 4) {
		for (let i = 0; i < right.sigBytes; i++) {
			const byte = (right.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
			const index = (left.sigBytes + i) >>> 2;
			words[index] = (words[index] ?? 0) | (byte << (24 - ((left.sigBytes + i) % 4) * 8));
		}
	} else {
		for (let i = 0; i < right.sigBytes; i += 4) {
			words[(left.sigBytes + i) >>> 2] = right.words[i >>> 2] ?? 0;
		}
	}
	return { words, sigBytes: left.sigBytes + right.sigBytes };
}

function bytesToWords(bytes: Uint8Array): WordArray {
	const words: number[] = [];
	for (let i = 0; i < bytes.length; i++) {
		words[i >>> 2] = (words[i >>> 2] ?? 0) | (bytes[i] << (24 - (i % 4) * 8));
	}
	return { words, sigBytes: bytes.length };
}

function utf8Words(value: string): WordArray {
	return bytesToWords(new TextEncoder().encode(value));
}

function hexParse(value: string): WordArray {
	const words: number[] = [];
	for (let i = 0; i < value.length; i += 2) {
		const parsed = parseInt(value.slice(i, i + 2), 16);
		const index = i >>> 3;
		words[index] =
			(words[index] ?? 0) | ((Number.isNaN(parsed) ? 0 : parsed) << (24 - (i % 8) * 4));
	}
	return { words, sigBytes: value.length / 2 };
}

function wordsToHex(words: readonly number[], key_length: number): string {
	let hex = '';
	for (let i = 0; i < key_length; i++) {
		const byte = ((words[i >>> 2] ?? 0) >>> (24 - (i % 4) * 8)) & 0xff;
		hex += byte.toString(16).padStart(2, '0');
	}
	return hex;
}

const SHA256_K = new Uint32Array([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function rotr(value: number, bits: number): number {
	return (value >>> bits) | (value << (32 - bits));
}

function sha256Words(input: WordArray): WordArray {
	const words = input.words.slice();
	const total_bits = input.sigBytes * 8;
	const left_bits = input.sigBytes * 8;
	const left_index = left_bits >>> 5;
	words[left_index] = (words[left_index] ?? 0) | (0x80 << (24 - (left_bits % 32)));
	const length_index = (((left_bits + 64) >>> 9) << 4) + 14;
	words[length_index] = Math.floor(total_bits / 0x100000000);
	words[length_index + 1] = total_bits | 0;

	const state = new Uint32Array([
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
	]);
	const schedule = new Uint32Array(64);
	const blocks = Math.ceil(words.length / 16);
	for (let block = 0; block < blocks; block++) {
		for (let i = 0; i < 16; i++) schedule[i] = words[block * 16 + i] | 0;
		for (let i = 16; i < 64; i++) {
			const s0 = rotr(schedule[i - 15], 7) ^ rotr(schedule[i - 15], 18) ^ (schedule[i - 15] >>> 3);
			const s1 = rotr(schedule[i - 2], 17) ^ rotr(schedule[i - 2], 19) ^ (schedule[i - 2] >>> 10);
			schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) | 0;
		}
		let a = state[0];
		let b = state[1];
		let c = state[2];
		let d = state[3];
		let e = state[4];
		let f = state[5];
		let g = state[6];
		let h = state[7];
		for (let i = 0; i < 64; i++) {
			const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
			const choose = (e & f) ^ (~e & g);
			const t1 = (h + s1 + choose + SHA256_K[i] + schedule[i]) | 0;
			const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
			const majority = (a & b) ^ (a & c) ^ (b & c);
			const t2 = (s0 + majority) | 0;
			h = g;
			g = f;
			f = e;
			e = (d + t1) | 0;
			d = c;
			c = b;
			b = a;
			a = (t1 + t2) | 0;
		}
		state[0] = (state[0] + a) | 0;
		state[1] = (state[1] + b) | 0;
		state[2] = (state[2] + c) | 0;
		state[3] = (state[3] + d) | 0;
		state[4] = (state[4] + e) | 0;
		state[5] = (state[5] + f) | 0;
		state[6] = (state[6] + g) | 0;
		state[7] = (state[7] + h) | 0;
	}
	return { words: Array.from(state), sigBytes: 32 };
}

function hmacSha256Words(key: WordArray, message: WordArray): WordArray {
	let normalized = key;
	if (key.sigBytes > 64) normalized = sha256Words(key);
	const outer_key: WordArray = {
		words: normalized.words.slice(),
		sigBytes: normalized.sigBytes
	};
	const inner_key: WordArray = {
		words: normalized.words.slice(),
		sigBytes: normalized.sigBytes
	};
	clampWords(outer_key.words, outer_key.sigBytes);
	clampWords(inner_key.words, inner_key.sigBytes);
	for (let i = 0; i < 16; i++) {
		outer_key.words[i] = (outer_key.words[i] ?? 0) ^ 0x5c5c5c5c;
		inner_key.words[i] = (inner_key.words[i] ?? 0) ^ 0x36363636;
	}
	outer_key.sigBytes = 64;
	inner_key.sigBytes = 64;
	const inner_input = concatWords(inner_key, message);
	const inner = sha256Words(inner_input);
	const outer_input = concatWords(outer_key, inner);
	return sha256Words(outer_input);
}

function pbkdf2Sha256Hex(passphrase: string, salt: string, iterations: number): string {
	const password = utf8Words(passphrase);
	const parsed_salt = hexParse(salt);
	const derived: number[] = [];
	let block = 1;
	while (derived.length * 4 < LEGACY_V1_KEY_BYTES) {
		const block_index: WordArray = { words: [block], sigBytes: 4 };
		let current = hmacSha256Words(password, concatWords(parsed_salt, block_index));
		const accumulated: WordArray = { words: current.words.slice(), sigBytes: current.sigBytes };
		for (let i = 1; i < iterations; i++) {
			current = hmacSha256Words(password, current);
			for (let j = 0; j < accumulated.words.length; j++) {
				accumulated.words[j] = (accumulated.words[j] ?? 0) ^ (current.words[j] ?? 0);
			}
		}
		derived.push(...accumulated.words);
		block++;
	}
	return wordsToHex(derived, LEGACY_V1_KEY_BYTES);
}

/* CryptoJS AES tables. */

const SBOX = new Uint8Array(256);
const INV_SBOX = new Uint8Array(256);
const SUB_MIX_0 = new Uint32Array(256);
const SUB_MIX_1 = new Uint32Array(256);
const SUB_MIX_2 = new Uint32Array(256);
const SUB_MIX_3 = new Uint32Array(256);
const INV_SUB_MIX_0 = new Uint32Array(256);
const INV_SUB_MIX_1 = new Uint32Array(256);
const INV_SUB_MIX_2 = new Uint32Array(256);
const INV_SUB_MIX_3 = new Uint32Array(256);

(function buildAesTables() {
	const doubles = new Uint8Array(256);
	for (let i = 0; i < 256; i++) doubles[i] = i < 128 ? i << 1 : (i << 1) ^ 0x11b;
	let x = 0;
	let inverse = 0;
	for (let i = 0; i < 256; i++) {
		let sbox = inverse ^ (inverse << 1) ^ (inverse << 2) ^ (inverse << 3) ^ (inverse << 4);
		sbox = (sbox >>> 8) ^ (sbox & 0xff) ^ 0x63;
		SBOX[x] = sbox;
		INV_SBOX[sbox] = x;
		const x2 = doubles[x];
		const x4 = doubles[x2];
		const x8 = doubles[x4];
		let mix = (doubles[sbox] * 0x101) ^ (sbox * 0x1010100);
		SUB_MIX_0[x] = (mix << 24) | (mix >>> 8);
		SUB_MIX_1[x] = (mix << 16) | (mix >>> 16);
		SUB_MIX_2[x] = (mix << 8) | (mix >>> 24);
		SUB_MIX_3[x] = mix;
		mix = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
		INV_SUB_MIX_0[sbox] = (mix << 24) | (mix >>> 8);
		INV_SUB_MIX_1[sbox] = (mix << 16) | (mix >>> 16);
		INV_SUB_MIX_2[sbox] = (mix << 8) | (mix >>> 24);
		INV_SUB_MIX_3[sbox] = mix;
		if (!x) {
			x = 1;
			inverse = 1;
		} else {
			x = x2 ^ doubles[doubles[doubles[x8 ^ x2]]];
			inverse ^= doubles[doubles[inverse]];
		}
	}
})();

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

interface AesSchedule {
	rounds: number;
	inverse: number[];
}

function scheduleAesKey(key: Uint8Array): AesSchedule {
	if (key.length === 0 || key.length % 4) {
		throw new LegacyV1Error('ciphertext', 'The legacy file key is not valid.');
	}
	const key_words: number[] = [];
	for (let i = 0; i < key.length; i++) {
		key_words[i >>> 2] = (key_words[i >>> 2] ?? 0) | (key[i] << (24 - (i % 4) * 8));
	}
	const key_size = key.length / 4;
	const rounds = key_size + 6;
	const rows = (rounds + 1) * 4;
	const schedule: number[] = new Array(rows);
	for (let row = 0; row < rows; row++) {
		if (row < key_size) {
			schedule[row] = key_words[row] ?? 0;
			continue;
		}
		let value = schedule[row - 1];
		if (row % key_size === 0) {
			value = (value << 8) | (value >>> 24);
			value =
				(SBOX[value >>> 24] << 24) |
				(SBOX[(value >>> 16) & 0xff] << 16) |
				(SBOX[(value >>> 8) & 0xff] << 8) |
				SBOX[value & 0xff];
			value ^= RCON[(row / key_size) | 0] << 24;
		} else if (key_size > 6 && row % key_size === 4) {
			value =
				(SBOX[value >>> 24] << 24) |
				(SBOX[(value >>> 16) & 0xff] << 16) |
				(SBOX[(value >>> 8) & 0xff] << 8) |
				SBOX[value & 0xff];
		}
		schedule[row] = (schedule[row - key_size] ?? 0) ^ value;
	}

	const inverse: number[] = new Array(rows);
	for (let inverse_row = 0; inverse_row < rows; inverse_row++) {
		const row = rows - inverse_row;
		const value = inverse_row % 4 ? schedule[row] : schedule[row - 4];
		if (inverse_row < 4 || row <= 4) {
			inverse[inverse_row] = value;
		} else {
			inverse[inverse_row] =
				INV_SUB_MIX_0[SBOX[value >>> 24]] ^
				INV_SUB_MIX_1[SBOX[(value >>> 16) & 0xff]] ^
				INV_SUB_MIX_2[SBOX[(value >>> 8) & 0xff]] ^
				INV_SUB_MIX_3[SBOX[value & 0xff]];
		}
	}
	return { rounds, inverse };
}

function decryptBlock(state: number[], rounds: number, inverse: number[]): void {
	let swap = state[1];
	state[1] = state[3];
	state[3] = swap;

	let s0 = state[0] ^ inverse[0];
	let s1 = state[1] ^ inverse[1];
	let s2 = state[2] ^ inverse[2];
	let s3 = state[3] ^ inverse[3];
	let key_row = 4;

	for (let round = 1; round < rounds; round++) {
		const t0 =
			INV_SUB_MIX_0[s0 >>> 24] ^
			INV_SUB_MIX_1[(s1 >>> 16) & 0xff] ^
			INV_SUB_MIX_2[(s2 >>> 8) & 0xff] ^
			INV_SUB_MIX_3[s3 & 0xff] ^
			inverse[key_row++];
		const t1 =
			INV_SUB_MIX_0[s1 >>> 24] ^
			INV_SUB_MIX_1[(s2 >>> 16) & 0xff] ^
			INV_SUB_MIX_2[(s3 >>> 8) & 0xff] ^
			INV_SUB_MIX_3[s0 & 0xff] ^
			inverse[key_row++];
		const t2 =
			INV_SUB_MIX_0[s2 >>> 24] ^
			INV_SUB_MIX_1[(s3 >>> 16) & 0xff] ^
			INV_SUB_MIX_2[(s0 >>> 8) & 0xff] ^
			INV_SUB_MIX_3[s1 & 0xff] ^
			inverse[key_row++];
		const t3 =
			INV_SUB_MIX_0[s3 >>> 24] ^
			INV_SUB_MIX_1[(s0 >>> 16) & 0xff] ^
			INV_SUB_MIX_2[(s1 >>> 8) & 0xff] ^
			INV_SUB_MIX_3[s2 & 0xff] ^
			inverse[key_row++];
		s0 = t0;
		s1 = t1;
		s2 = t2;
		s3 = t3;
	}

	state[0] =
		((INV_SBOX[s0 >>> 24] << 24) |
			(INV_SBOX[(s1 >>> 16) & 0xff] << 16) |
			(INV_SBOX[(s2 >>> 8) & 0xff] << 8) |
			INV_SBOX[s3 & 0xff]) ^
		inverse[key_row++];
	state[1] =
		((INV_SBOX[s1 >>> 24] << 24) |
			(INV_SBOX[(s2 >>> 16) & 0xff] << 16) |
			(INV_SBOX[(s3 >>> 8) & 0xff] << 8) |
			INV_SBOX[s0 & 0xff]) ^
		inverse[key_row++];
	state[2] =
		((INV_SBOX[s2 >>> 24] << 24) |
			(INV_SBOX[(s3 >>> 16) & 0xff] << 16) |
			(INV_SBOX[(s0 >>> 8) & 0xff] << 8) |
			INV_SBOX[s1 & 0xff]) ^
		inverse[key_row++];
	state[3] =
		((INV_SBOX[s3 >>> 24] << 24) |
			(INV_SBOX[(s0 >>> 16) & 0xff] << 16) |
			(INV_SBOX[(s1 >>> 8) & 0xff] << 8) |
			INV_SBOX[s2 & 0xff]) ^
		inverse[key_row];

	swap = state[1];
	state[1] = state[3];
	state[3] = swap;
}

function decryptCbc(cipher: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
	const { rounds, inverse } = scheduleAesKey(key);
	const plain = new Uint8Array(cipher.length);
	let previous = iv;
	for (let offset = 0; offset < cipher.length; offset += 16) {
		const state = new Array<number>(4).fill(0);
		for (let i = 0; i < 16; i++) {
			state[i >>> 2] |= cipher[offset + i] << (24 - (i % 4) * 8);
		}
		decryptBlock(state, rounds, inverse);
		for (let i = 0; i < 16; i++) {
			plain[offset + i] = ((state[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff) ^ previous[i];
		}
		previous = cipher.subarray(offset, offset + 16);
	}
	const padding = plain[plain.length - 1];
	if (padding < 1 || padding > 16 || padding > plain.length) {
		throw new LegacyV1Error('ciphertext', 'The legacy file could not be decrypted.');
	}
	for (let i = plain.length - padding; i < plain.length; i++) {
		if (plain[i] !== padding) {
			throw new LegacyV1Error('ciphertext', 'The legacy file could not be decrypted.');
		}
	}
	return plain.subarray(0, plain.length - padding);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
	return difference === 0;
}

async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
	const crypto_key = await crypto.subtle.importKey(
		'raw',
		key as BufferSource,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', crypto_key, message as BufferSource);
	return new Uint8Array(signature);
}

export async function decryptLegacyV1<T>(
	raw: string,
	credentials: LegacyV1Credentials
): Promise<LegacyV1Result<T>> {
	const envelope = decodeEnvelope(raw);
	const salts = [...new Set(credentials.salts.filter((salt) => salt.length > 0))];
	if (!salts.length) {
		throw new LegacyV1Error('format', 'No legacy key candidates are available.');
	}
	const message = new TextEncoder().encode(`${envelope.iv_base64}${envelope.cipher_base64}`);
	for (const salt of salts) {
		const key_hex = pbkdf2Sha256Hex(credentials.passphrase, salt, LEGACY_V1_ITERATIONS);
		const key = new TextEncoder().encode(key_hex);
		if (!equalBytes(await hmacSha256(key, message), envelope.hmac)) continue;
		const plain = decryptCbc(envelope.cipher, key, envelope.iv);
		let text: string;
		try {
			text = new TextDecoder('utf-8', { fatal: true }).decode(plain);
		} catch {
			throw new LegacyV1Error('payload', 'The legacy file payload is not valid.');
		}
		try {
			return { data: JSON.parse(text) as T, salt };
		} catch {
			throw new LegacyV1Error('payload', 'The legacy file payload is not valid.');
		}
	}
	throw new LegacyV1Error(
		'integrity',
		'Legacy integrity check failed. The file may be damaged or use different legacy keys.'
	);
}
