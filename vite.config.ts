import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

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
	// ES output keeps the export worker's `import('exceljs')` as a separate
	// lazy chunk instead of inlining ~1 MB into the worker entry (the default
	// worker format is iife, which has no code splitting).
	worker: {
		format: 'es'
	},
	server: {
		fs: {
			allow: ['package.json']
		},
		hmr: {
			host: 'localhost'
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
