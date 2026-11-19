// @vitest-environment jsdom
/**
 * The saved riser SVG (`crates/heda-core/src/riser_svg.rs`) copies this component's
 * drawing by hand. This keeps the two the same: every sample, drawn both ways, element
 * by element, with the screen's theme classes read as the file's print colours.
 */
import { readFileSync } from 'node:fs';
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import { engineFile } from '#lib/core/api.js';
import { decryptFilePayload } from '#lib/helpers/file/format.js';
import { loadCurrentProject } from '#lib/db/mutations/index.js';
import { getRiserAsync } from '#lib/db/queries/index.js';
import { loadSnapshot } from '#lib/db/queries/snapshot.js';
import { settled } from '#lib/db/index.js';
import {
	SAMPLE_PASSWORD,
	SAMPLES_DIR,
	samples,
	withEverythingOn
} from '#lib/core/golden-samples.js';
import type { FileExport } from '#lib/types/main.js';
import RiserDrawing from './riser-drawing.svelte';

/** The theme classes on screen, as the file prints them. */
const PRINT_FILL: Record<string, string> = {
	'fill-card': '#ffffff',
	'fill-muted-foreground': '#333333'
};
/** Screen-only (pan, zoom, theme) or file-only (SVG 1.1 links). */
const IGNORED = new Set(['class', 'transform', 'data-viewport', 'vector-effect', 'xlink:href']);
/** On the root only: the screen sizes it by CSS, the file prints a page of its own. */
const ROOT_IGNORED = new Set([
	'xmlns',
	'xmlns:xlink',
	'width',
	'height',
	'viewBox',
	'color',
	'font-family'
]);

describe('riser drawing and the saved SVG', () => {
	for (const sample of samples) {
		for (const variant of [false, true]) {
			const name = variant ? `${sample}.variant` : sample;
			it(`draws ${name} the same way`, { timeout: 120_000 }, async () => {
				const raw = readFileSync(`${SAMPLES_DIR}${sample}.heda`, 'utf8');
				const file_export = await decryptFilePayload<FileExport>(raw, SAMPLE_PASSWORD);
				await loadCurrentProject(variant ? withEverythingOn(file_export) : file_export);
				await settled();
				const node_id = loadSnapshot().root!.id;
				const layout = (await getRiserAsync(node_id))!;

				const target = document.createElement('div');
				const drawing = mount(RiserDrawing, {
					target,
					props: { layout, items: layout, detail: true }
				});
				flushSync();
				const screen = elements(target.querySelector('svg')!);
				unmount(drawing);

				const bytes = await engineFile('riser_svg', { node_id });
				const file = new DOMParser().parseFromString(
					new TextDecoder().decode(bytes),
					'image/svg+xml'
				);
				expect(file.querySelector('parsererror')).toBeNull();
				const [root, page, ...rest] = elements(file.documentElement);
				// A white page behind everything, first; the screen has the card behind it.
				expect(page).toBe('rect fill="#ffffff" height="100%" width="100%"');
				expect([root, ...rest]).toEqual(screen);
			});
		}
	}
});

/** Every element in document order, as its tag, compared attributes and own text. */
function elements(svg: Element): string[] {
	return [svg, ...svg.querySelectorAll('*')].map((el) => {
		const attrs: string[] = [];
		for (const { name, value } of el.attributes) {
			if (name === 'class' && PRINT_FILL[value]) attrs.push(`fill="${PRINT_FILL[value]}"`);
			else if (!IGNORED.has(name) && !(el === svg && ROOT_IGNORED.has(name)))
				attrs.push(`${name}="${name === 'd' ? path(value) : value}"`);
		}
		const text = el.tagName === 'text' ? ` ${el.textContent?.trim()}` : '';
		return `${el.tagName} ${attrs.sort().join(' ')}${text}`.trimEnd();
	});
}

/** Path data without the separators the two writers place differently. */
function path(d: string): string {
	return d.replace(/[\s,]+/g, ' ').replace(/ ?([A-Za-z]) ?/g, '$1');
}
