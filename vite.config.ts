import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig(({ command, mode, isPreview }) => ({
	// Component tests use a per-file `// @vitest-environment jsdom` comment, so the
	// node unit tests keep running without a DOM. Browser entries resolve under VITEST
	// (Svelte docs) so `mount` gets the client build. Tailwind is off under VITEST:
	// tests assert class strings, never computed styles.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	plugins: [
		...(process.env.VITEST ? [] : [tailwindcss()]),
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			paths: {
				base: basePath(command === 'serve' && !isPreview, mode)
			}
		})
	],
	// Legacy v1 files only open in the desktop app (the web build has no file
	// access), so web builds never ship the migration keys.
	define:
		command === 'build' && !process.env.TAURI_ENV_PLATFORM
			? {
					'import.meta.env.VITE_LEGACY_FILE_PASSPHRASE': '""',
					'import.meta.env.VITE_LEGACY_FILE_SALT': '""'
				}
			: undefined,
	// The Rust engine needs its `.wasm` before any test computes; see the setup file.
	test: {
		setupFiles: ['./src/lib/core/vitest-setup.ts'],
		// Local worktrees under .claude/ are other checkouts, not part of this suite.
		exclude: [...configDefaults.exclude, '.claude/**']
	},
	// `tauri android dev` on a phone sets TAURI_DEV_HOST to this machine's LAN
	// address: the phone loads the page and hot reload from there, not localhost.
	server: {
		host: process.env.TAURI_DEV_HOST || undefined,
		fs: {
			allow: ['package.json']
		},
		hmr: {
			host: process.env.TAURI_DEV_HOST || 'localhost'
		}
	}
}));

/**
 * The web build's base path, from the shell or `.env` (Vite has not loaded
 * `.env` into `process.env` while this file runs, so read it with `loadEnv`).
 * Dev servers and desktop builds always use the root: the Tauri CLI sets
 * `TAURI_ENV_PLATFORM` for its before-commands, and a web base path there
 * would point the packaged app at assets that do not exist.
 */
function basePath(is_dev_server: boolean, mode: string): '' | `/${string}` | undefined {
	if (is_dev_server || process.env.TAURI_ENV_PLATFORM) return '';
	return loadEnv(mode, process.cwd(), '').BASE_PATH as `/${string}` | undefined;
}
