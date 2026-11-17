// A popout is an `about:blank` window the opener renders into directly, so it
// shares the opener's JS state (store, session, forms) instead of booting a
// second app. These helpers only prepare that window; mounting lives in
// `#lib/components/custom/popout`.

import { isTauri } from '@tauri-apps/api/core';
import { Window as NativeWindow } from '@tauri-apps/api/window';

const STYLE_SELECTOR = 'style, link[rel="stylesheet"]';
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
 * Keeps `target` styled like `source`: copies its stylesheets and theme root
 * attributes now and on every later change (Vite HMR, theme switches), until
 * the returned cleanup runs.
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
			const existing = clones.get(node);
			if (existing) {
				if (existing.textContent !== node.textContent) existing.textContent = node.textContent;
				continue;
			}
			const clone = node.cloneNode(true) as Element;
			// Absolute, so the sheet resolves no matter what base URL the popout has.
			if (node instanceof HTMLLinkElement) clone.setAttribute('href', node.href);
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
	const head = new MutationObserver(syncStyles);
	head.observe(source.head, { childList: true, subtree: true, characterData: true });
	const root = new MutationObserver(syncRoot);
	root.observe(source.documentElement, {
		attributes: true,
		attributeFilter: MIRRORED_ROOT_ATTRIBUTES
	});

	return () => {
		head.disconnect();
		root.disconnect();
		for (const clone of clones.values()) clone.remove();
		clones.clear();
	};
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
