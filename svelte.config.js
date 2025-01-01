import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsx } from 'mdsx';
import { mdsxConfig } from './mdsx.config.js';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: [mdsx(mdsxConfig), vitePreprocess()],
	extensions: ['.svelte', '.md'],
	kit: {
		adapter: adapter(),
		paths: {
			base: process.argv.includes('dev') ? '' : process.env.BASE_PATH
		},
		alias: {
			'@/*': './src/lib/*',
			'@routes/*': './src/routes/*'
		},
	}
};

export default config;
