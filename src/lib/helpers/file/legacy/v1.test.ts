import { describe, expect, it } from 'vitest';
import {
	LEGACY_V1_FIXTURE_FILE_PATH,
	LEGACY_V1_FIXTURE_FIXED_SALT,
	LEGACY_V1_FIXTURE_PASSPHRASE,
	LEGACY_V1_FIXTURE_PAYLOAD,
	LEGACY_V1_FIXTURE_STEM_SALT,
	LEGACY_V1_GIBBERISH_STEM,
	LEGACY_V1_PLAIN_FIXED,
	LEGACY_V1_PLAIN_STEM
} from './fixtures.js';
import {
	isLegacyV1Envelope,
	legacyV1SaltCandidates,
	LegacyV1Error,
	decryptLegacyV1
} from './v1.js';

const CREDENTIALS = {
	passphrase: LEGACY_V1_FIXTURE_PASSPHRASE,
	salts: [LEGACY_V1_FIXTURE_FIXED_SALT]
};

function mutatePart(raw: string, part: number): string {
	const parts = raw.split(':');
	const value = parts[part];
	parts[part] = `${value[0] === 'A' ? 'B' : 'A'}${value.slice(1)}`;
	return parts.join(':');
}

async function expectCode(raw: string, code: LegacyV1Error['code']): Promise<void> {
	const err = (await decryptLegacyV1(raw, CREDENTIALS).catch((e) => e)) as LegacyV1Error;
	expect(err).toBeInstanceOf(LegacyV1Error);
	expect(err.code).toBe(code);
}

describe('legacy v1 reader', () => {
	it('decrypts a fixed-salt envelope', async () => {
		const result = await decryptLegacyV1(LEGACY_V1_PLAIN_FIXED, CREDENTIALS);
		expect(result.data).toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
		expect(result.salt).toBe(LEGACY_V1_FIXTURE_FIXED_SALT);
	});

	it('falls back to the file-stem salt', async () => {
		const result = await decryptLegacyV1(LEGACY_V1_PLAIN_STEM, {
			...CREDENTIALS,
			salts: [LEGACY_V1_FIXTURE_FIXED_SALT, LEGACY_V1_FIXTURE_STEM_SALT]
		});
		expect(result.data).toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
		expect(result.salt).toBe(LEGACY_V1_FIXTURE_STEM_SALT);
	});

	it('reverses the pre-1.6 gibberish character map', async () => {
		const result = await decryptLegacyV1(LEGACY_V1_GIBBERISH_STEM, {
			...CREDENTIALS,
			salts: [LEGACY_V1_FIXTURE_STEM_SALT]
		});
		expect(result.data).toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
	});

	it('ignores a stale tail after the first complete envelope', async () => {
		const result = await decryptLegacyV1(`${LEGACY_V1_PLAIN_FIXED}:stale`, CREDENTIALS);
		expect(result.data).toEqual(LEGACY_V1_FIXTURE_PAYLOAD);
	});

	it('rejects a wrong passphrase as an integrity failure', async () => {
		await expect(
			decryptLegacyV1(LEGACY_V1_PLAIN_FIXED, {
				passphrase: 'wrong-passphrase',
				salts: [LEGACY_V1_FIXTURE_FIXED_SALT]
			}).catch((e) => e)
		).resolves.toMatchObject({ code: 'integrity' });
	});

	it('rejects tampered IVs, HMACs and ciphertext', async () => {
		await expectCode(mutatePart(LEGACY_V1_PLAIN_FIXED, 0), 'integrity');
		await expectCode(mutatePart(LEGACY_V1_PLAIN_FIXED, 1), 'integrity');
		await expectCode(mutatePart(LEGACY_V1_PLAIN_FIXED, 2), 'integrity');
	});

	it('rejects malformed envelopes', async () => {
		await expectCode('not-an-envelope', 'format');
		await expectCode('a:b', 'format');
		await expectCode('!!!!:!!!!:!!!!', 'format');
		await expectCode(`${LEGACY_V1_PLAIN_FIXED.split(':')[0]}:AA==:AA==`, 'format');
	});

	it('recognizes v1 envelopes only', () => {
		expect(isLegacyV1Envelope(LEGACY_V1_PLAIN_FIXED)).toBe(true);
		expect(isLegacyV1Envelope(LEGACY_V1_PLAIN_STEM)).toBe(true);
		expect(isLegacyV1Envelope(LEGACY_V1_GIBBERISH_STEM)).toBe(true);
		expect(isLegacyV1Envelope('{"v":2,"salt":"x","payload":"y"}')).toBe(false);
		expect(isLegacyV1Envelope('not an envelope')).toBe(false);
	});

	it('tries the configured salt before the filename stem', () => {
		expect(legacyV1SaltCandidates(LEGACY_V1_FIXTURE_FILE_PATH, '@configured')).toEqual([
			'@configured',
			LEGACY_V1_FIXTURE_STEM_SALT
		]);
		expect(legacyV1SaltCandidates('C:\\projects\\Panel (1).heda', '@configured')).toEqual([
			'@configured',
			'Panel (1)'
		]);
		expect(legacyV1SaltCandidates('/tmp/NoExtension', '@configured')).toEqual([
			'@configured',
			'NoExtension'
		]);
		expect(legacyV1SaltCandidates('/tmp/NoExtension', '')).toEqual(['NoExtension']);
	});
});
