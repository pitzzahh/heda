import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { showInFolderAction } from '#lib/helpers/file/reveal.js';
import { isAndroidApp } from '#lib/helpers/platform.js';

/** Print colours for the theme classes the on-screen diagram uses. */
const PRINT_FILLS: Record<string, string> = {
	'fill-card': '#ffffff',
	'fill-muted-foreground': '#333333'
};

/**
 * A standalone copy of the on-screen riser diagram for the permit sheet set: black on
 * white whatever the app theme, no CSS classes, and a font every viewer has.
 */
export function printableSvg(svg: SVGSVGElement): string {
	const copy = svg.cloneNode(true) as SVGSVGElement;
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

/** Saves the diagram where the user picks, like the Excel export. */
export async function exportRiserSvg(svg: SVGSVGElement, name: string): Promise<void> {
	const path = await saveDialog({
		defaultPath: `${name} Riser Diagram.svg`,
		filters: [{ name: 'SVG image', extensions: ['svg'] }]
	});
	if (!path) return;
	await writeFile(path, new TextEncoder().encode(printableSvg(svg)));
	toast.success('Riser diagram saved.', {
		// On Android the path is an opaque content:// document link.
		description: isAndroidApp() ? 'Saved where you picked in the file picker.' : path,
		action: showInFolderAction(path),
		position: 'bottom-center'
	});
}
