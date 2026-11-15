import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			paths: {
				base: (process.argv.includes('dev') ? '' : process.env.BASE_PATH) as
					'' | `/${string}` | undefined
			}
		})
	],
	server: {
		fs: {
			allow: ['package.json']
		},
		hmr: {
			host: 'localhost'
		}
	}
});
