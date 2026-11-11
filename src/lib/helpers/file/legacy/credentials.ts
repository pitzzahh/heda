// Build-time keys that open legacy v1 files. Old releases embedded the same
// app-wide values, so they add no exposure; they are still kept out of source
// and supplied through `.env` (local) or GitHub secrets (release builds).
export interface LegacyV1Config {
	passphrase: string;
	salt: string;
}

export function getLegacyV1Config(): LegacyV1Config | null {
	// Read each key directly: Vite then inlines just these two values instead of
	// the whole env object, and web builds can define them away (vite.config.ts).
	const passphrase = import.meta.env.VITE_LEGACY_FILE_PASSPHRASE as string | undefined;
	const salt = import.meta.env.VITE_LEGACY_FILE_SALT as string | undefined;
	if (!passphrase || !salt) return null;
	return { passphrase, salt };
}

export function isLegacyV1MigrationConfigured(): boolean {
	return getLegacyV1Config() !== null;
}
