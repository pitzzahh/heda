// Build-time keys that open legacy v1 files. Old releases embedded the same
// app-wide values, so they add no exposure; they are still kept out of source
// and supplied through `.env` (local) or GitHub secrets (release builds).
export interface LegacyV1Config {
	passphrase: string;
	salt: string;
}

interface LegacyV1Env {
	VITE_LEGACY_FILE_PASSPHRASE?: string;
	VITE_LEGACY_FILE_SALT?: string;
}

export function getLegacyV1Config(): LegacyV1Config | null {
	const env = import.meta.env as LegacyV1Env;
	const passphrase = env.VITE_LEGACY_FILE_PASSPHRASE;
	const salt = env.VITE_LEGACY_FILE_SALT;
	if (!passphrase || !salt) return null;
	return { passphrase, salt };
}

export function isLegacyV1MigrationConfigured(): boolean {
	return getLegacyV1Config() !== null;
}
