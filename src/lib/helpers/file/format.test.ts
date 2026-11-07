import { describe, expect, it } from 'vitest';
import {
	FileLegacyError,
	FilePasswordError,
	decryptFilePayload,
	detectFileVersion,
	packFileV2
} from './format.js';

// Sample v1 bytes (kept only so the refusal path tests the real shape).
const GOLDEN =
	'G7JNhp76jXwfI3zwqaaeoQ==:eb+1N45kbgXIluv1PzsA3T6mCIgRgvuNJptMBtqkBB0=:BtWa2mNahLn5SnEMiHsM5/ylnE3RmB/DYGgnsUMwK4s=';

describe('file format', () => {
	it('detects v2 envelopes', async () => {
		expect(detectFileVersion(await packFileV2({ a: 1 }, 'pw'))).toBe(2);
	});

	it('detects legacy files and garbage as v1', () => {
		expect(detectFileVersion(GOLDEN)).toBe(1);
		expect(detectFileVersion('not-json:::')).toBe(1);
	});

	it('round-trips v2 with a password', async () => {
		const raw = await packFileV2({ a: 1 }, 'correct-horse');
		await expect(decryptFilePayload(raw, 'correct-horse')).resolves.toEqual({ a: 1 });
	});

	it('opens v2 with a stale tail from an untruncated overwrite', async () => {
		const first = await packFileV2({ a: 1, padding: 'x'.repeat(64) }, 'pw');
		const second = await packFileV2({ a: 1 }, 'pw');
		expect(second.length).toBeLessThan(first.length);
		const corrupted = second + first.slice(second.length);
		expect(detectFileVersion(corrupted)).toBe(2);
		await expect(decryptFilePayload(corrupted, 'pw')).resolves.toEqual({ a: 1 });
	});

	it('still refuses files truncated inside the envelope', async () => {
		const raw = await packFileV2({ a: 1 }, 'pw');
		await expect(decryptFilePayload(raw.slice(0, raw.length - 10), 'pw')).rejects.toBeInstanceOf(
			FileLegacyError
		);
	});

	it('requires a password for v2', async () => {
		const raw = await packFileV2({ a: 1 }, 'pw');
		const err = (await decryptFilePayload(raw, null).catch((e) => e)) as FilePasswordError;
		expect(err).toBeInstanceOf(FilePasswordError);
		expect(err.code).toBe('required');
	});

	it('rejects v2 with a wrong password', async () => {
		const raw = await packFileV2({ a: 1 }, 'pw');
		const err = (await decryptFilePayload(raw, 'wrong').catch((e) => e)) as FilePasswordError;
		expect(err).toBeInstanceOf(FilePasswordError);
		expect(err.code).toBe('invalid');
	});

	it('refuses legacy files with a clear error', async () => {
		await expect(decryptFilePayload(GOLDEN, 'pw')).rejects.toBeInstanceOf(FileLegacyError);
	});
});
