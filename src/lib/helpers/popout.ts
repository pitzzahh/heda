// A popout is an `about:blank` window the opener renders into directly, so it
// shares the opener's JS state (store, session, forms) instead of booting a
// second app. These helpers only prepare that window; mounting lives in
// `#lib/components/custom/popout`.

import { isTauri } from '@tauri-apps/api/core';
import { Window as NativeWindow } from '@tauri-apps/api/window';

const STYLE_SELECTOR = 'style, link[rel="stylesheet"]';
/**
 * A `url("…")` as CSSOM `cssText` writes it (always double-quoted).
 * shortcut: escaped URLs and unquoted ones kept verbatim in custom properties
 * stay relative; match those too if a stylesheet ever puts assets there.
 */
const CSS_URL = /url\("([^"\\]*)"\)/g;
/** Root attributes that carry the theme (mode-watcher class, color vars, color-scheme). */
const MIRRORED_ROOT_ATTRIBUTES = ['class', 'style', 'lang', 'dir'];

/** A popout window plus its Tauri label (`popout-<id>`, see `popout_label` in `src-tauri/src/lib.rs`). */
export interface PopoutWindow {
	win: Window;
	label: string;
}

/**
 * Opens an empty standards-mode window linked to this one. Returns null when
 * the window was blocked (popup blocker, or the host denied `window.open`).
 */
export function openPopoutWindow(
	title: string,
	width: number,
	height: number
): PopoutWindow | null {
	const id = crypto.randomUUID();
	// `about:blank#<id>` still loads the blank page synchronously (the fragment is
	// ignored there) and tells Tauri which label to give the native window. Never
	// '': WebKitGTK reports it as an empty URL, which Tauri denies.
	const win = window.open(`about:blank#${id}`, '', `popup,width=${width},height=${height}`);
	if (!win) return null;
	// A fresh `about:blank` is in quirks mode; rewrite it so layout matches the app.
	win.document.open();
	win.document.write(
		'<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'
	);
	win.document.close();
	win.document.title = title;
	return { win, label: `popout-${id}` };
}

/**
 * Brings a popout to the front. In Tauri this goes through the native window:
 * WebKitGTK ignores an opener's `win.focus()`.
 */
export async function focusPopoutWindow({ win, label }: PopoutWindow): Promise<void> {
	const native = isTauri() ? await NativeWindow.getByLabel(label) : null;
	if (!native) return win.focus();
	await native.unminimize();
	await native.setFocus();
}

/**
 * Closes a popout. In Tauri this destroys the native window: WebKitGTK only
 * tears down the web view on an opener's `win.close()`, leaving an empty window.
 */
export async function closePopoutWindow({ win, label }: PopoutWindow): Promise<void> {
	const native = isTauri() ? await NativeWindow.getByLabel(label) : null;
	if (!native) return win.close();
	await native.destroy();
}

/**
 * Keeps `target` styled like `source`: copies its stylesheets (linked ones as
 * inline `<style>`, see `linkedCss`) and theme root attributes now and on every
 * later change (Vite HMR, theme switches), until the returned cleanup runs.
 */
export function mirrorDocumentStyles(source: Document, target: Document): () => void {
	const clones = new Map<Element, Element>();

	const syncStyles = () => {
		const current = new Set(source.head.querySelectorAll(STYLE_SELECTOR));
		for (const [node, clone] of clones) {
			if (current.has(node)) continue;
			clone.remove();
			clones.delete(node);
		}
		for (const node of current) {
			const link = node instanceof HTMLLinkElement ? node : null;
			const existing = clones.get(node);
			// A loaded sheet's rules never change: copy each link once, not on every head mutation.
			if (link && existing) continue;
			const css = link ? linkedCss(link) : node.textContent;
			// A link still loading: the head's `load` listener syncs it once it lands.
			if (css === null) continue;
			if (existing) {
				if (existing.textContent !== css) existing.textContent = css;
				continue;
			}
			const clone = link
				? Object.assign(target.createElement('style'), { media: link.media })
				: (node.cloneNode(true) as Element);
			clone.textContent = css;
			target.head.append(clone);
			clones.set(node, clone);
		}
	};

	const syncRoot = () => {
		for (const name of MIRRORED_ROOT_ATTRIBUTES) {
			const value = source.documentElement.getAttribute(name);
			if (value === null) target.documentElement.removeAttribute(name);
			else target.documentElement.setAttribute(name, value);
		}
	};

	syncStyles();
	syncRoot();
	// `load` does not bubble; capture catches each linked sheet as it finishes.
	source.head.addEventListener('load', syncStyles, true);
	const head = new MutationObserver(syncStyles);
	head.observe(source.head, { childList: true, subtree: true, characterData: true });
	const root = new MutationObserver(syncRoot);
	root.observe(source.documentElement, {
		attributes: true,
		attributeFilter: MIRRORED_ROOT_ATTRIBUTES
	});

	return () => {
		source.head.removeEventListener('load', syncStyles, true);
		head.disconnect();
		root.disconnect();
		for (const clone of clones.values()) clone.remove();
		clones.clear();
	};
}

/**
 * The rules of a loaded stylesheet link, or null while it loads. Popouts get
 * them inline so they never fetch a sheet: WebView2 (Windows) attaches the
 * popout to its webview only after `window.open` returns, so a cloned `<link>`
 * requests its sheet before the app's asset handler exists and never styles.
 * Relative `url()`s are made absolute, as inline text no longer has the sheet's URL.
 */
function linkedCss(link: HTMLLinkElement): string | null {
	try {
		const rules = link.sheet?.cssRules;
		if (!rules) return null;
		return Array.from(rules, (rule) => rule.cssText)
			.join('\n')
			.replace(CSS_URL, (_, url: string) => `url("${resolveCssUrl(url, link.href)}")`);
	} catch {
		return null;
	}
}

/** `url` against `base`, keeping same-document `#id` references (SVG masks, filters). */
function resolveCssUrl(url: string, base: string): string {
	if (url.startsWith('#')) return url;
	try {
		return new URL(url, base).href;
	} catch {
		return url;
	}
}

/**
 * Calls `onClose` once when `win` closes, however that happens. `pagehide`
 * is the fast path; polling covers hosts that destroy the window without
 * firing it (a native close in Tauri). Returns a cleanup that stops watching.
 */
export function watchWindowClosed(win: Window, onClose: () => void, interval = 500): () => void {
	let done = false;
	const stop = () => {
		done = true;
		clearInterval(timer);
		win.removeEventListener('pagehide', close);
	};
	const close = () => {
		if (done) return;
		stop();
		onClose();
	};
	const timer = setInterval(() => {
		if (win.closed) close();
	}, interval);
	win.addEventListener('pagehide', close);
	return stop;
}
