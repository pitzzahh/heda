import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
				base: (process.argv.includes('dev') ? '' : process.env.BASE_PATH) as
					'' | `/${string}` | undefined
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
});
