import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLegacyV1Config, isLegacyV1MigrationConfigured } from './credentials.js';

beforeEach(() => {
	vi.stubEnv('VITE_LEGACY_FILE_PASSPHRASE', '');
	vi.stubEnv('VITE_LEGACY_FILE_SALT', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('legacy v1 credentials', () => {
	it('reads the configured key pair', () => {
		vi.stubEnv('VITE_LEGACY_FILE_PASSPHRASE', 'passphrase');
		vi.stubEnv('VITE_LEGACY_FILE_SALT', 'salt');

		expect(getLegacyV1Config()).toEqual({ passphrase: 'passphrase', salt: 'salt' });
		expect(isLegacyV1MigrationConfigured()).toBe(true);
	});

	it('reports no configuration when the pair is incomplete', () => {
		vi.stubEnv('VITE_LEGACY_FILE_PASSPHRASE', 'passphrase');
		vi.stubEnv('VITE_LEGACY_FILE_SALT', '');

		expect(getLegacyV1Config()).toBeNull();
		expect(isLegacyV1MigrationConfigured()).toBe(false);
	});
});
