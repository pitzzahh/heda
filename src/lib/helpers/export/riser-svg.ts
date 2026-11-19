import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { flushSync, mount, unmount } from 'svelte';
import type { RiserLayout } from '#lib/types/riser.js';
import RiserDrawing from '#lib/components/custom/riser/riser-drawing.svelte';
import { showInFolderAction } from '#lib/helpers/file/reveal.js';
import { isAndroidApp } from '#lib/helpers/platform.js';

/** Print colours for the theme classes the on-screen diagram uses. */
const PRINT_FILLS: Record<string, string> = {
	'fill-card': '#ffffff',
	'fill-muted-foreground': '#333333'
};

/**
 * A standalone copy of the on-screen riser diagram for the permit sheet set: the whole
 * diagram at 100 % whatever the pan and zoom, black on white whatever the app theme, no
 * CSS classes, and a font every viewer has.
 */
export function printableSvg(svg: SVGSVGElement, size: { width: number; height: number }): string {
	const copy = svg.cloneNode(true) as SVGSVGElement;
	copy.setAttribute('width', String(size.width));
	copy.setAttribute('height', String(size.height));
	copy.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`);
	for (const viewport of copy.querySelectorAll('[data-viewport]')) {
		viewport.removeAttribute('transform');
		viewport.removeAttribute('data-viewport');
	}
	copy.setAttribute('color', '#000000');
	copy.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
	for (const element of [copy, ...copy.querySelectorAll('[class]')]) {
		const fill = [...element.classList].map((name) => PRINT_FILLS[name]).find(Boolean);
		if (fill) element.setAttribute('fill', fill);
		element.removeAttribute('class');
	}
	const background = copy.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
	background.setAttribute('width', '100%');
	background.setAttribute('height', '100%');
	background.setAttribute('fill', '#ffffff');
	copy.prepend(background);
	return new XMLSerializer().serializeToString(copy);
}

/**
 * The whole diagram as SVG text. The screen only draws what is in view, so this mounts
 * its own full-detail drawing off the page and serialises that.
 */
export function riserSvgText(layout: RiserLayout): string {
	const host = document.createElement('div');
	const drawing = mount(RiserDrawing, {
		target: host,
		props: { layout, items: layout, detail: true }
	});
	flushSync();
	try {
		return printableSvg(host.querySelector('svg')!, layout);
	} finally {
		void unmount(drawing);
	}
}

/** Saves the diagram where the user picks, like the Excel export. */
export async function exportRiserSvg(layout: RiserLayout, name: string): Promise<void> {
	const path = await saveDialog({
		defaultPath: `${name} Riser Diagram.svg`,
		filters: [{ name: 'SVG image', extensions: ['svg'] }]
	});
	if (!path) return;
	await writeFile(path, new TextEncoder().encode(riserSvgText(layout)));
	toast.success('Riser diagram saved.', {
		// On Android the path is an opaque content:// document link.
		description: isAndroidApp() ? 'Saved where you picked in the file picker.' : path,
		action: showInFolderAction(path),
		position: 'bottom-center'
	});
}
