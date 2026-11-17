// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mirrorDocumentStyles, watchWindowClosed } from './popout.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mirrorDocumentStyles', () => {
	const target = document.implementation.createHTMLDocument('popout');
	let stop = () => {};

	afterEach(() => {
		stop();
		document.head.innerHTML = '';
		document.documentElement.removeAttribute('class');
		document.documentElement.removeAttribute('style');
	});

	it('copies stylesheets with absolute hrefs and the theme root attributes', () => {
		document.head.innerHTML =
			'<link rel="stylesheet" href="/app.css"><style>.a{color:red}</style><title>x</title>';
		document.documentElement.className = 'dark';
		document.documentElement.style.setProperty('--primary', 'blue');

		stop = mirrorDocumentStyles(document, target);

		const link = target.head.querySelector('link');
		expect(link?.getAttribute('href')).toBe(new URL('/app.css', document.baseURI).href);
		expect(target.head.querySelector('style')?.textContent).toBe('.a{color:red}');
		expect(target.title).toBe('popout');
		expect(target.documentElement.className).toBe('dark');
		expect(target.documentElement.style.getPropertyValue('--primary')).toBe('blue');
	});

	it('follows added, edited and removed styles and theme switches', async () => {
		document.head.innerHTML = '<style>.a{}</style>';
		stop = mirrorDocumentStyles(document, target);

		const added = document.createElement('style');
		added.textContent = '.b{}';
		document.head.append(added);
		document.head.querySelector('style')!.textContent = '.a{color:red}';
		document.documentElement.className = 'dark';
		await flush();
		expect([...target.head.querySelectorAll('style')].map((s) => s.textContent)).toEqual([
			'.a{color:red}',
			'.b{}'
		]);
		expect(target.documentElement.className).toBe('dark');

		added.remove();
		document.documentElement.removeAttribute('class');
		await flush();
		expect(target.head.querySelectorAll('style')).toHaveLength(1);
		expect(target.documentElement.hasAttribute('class')).toBe(false);
	});

	it('removes its copies and stops following on cleanup', async () => {
		document.head.innerHTML = '<style>.a{}</style>';
		mirrorDocumentStyles(document, target)();
		document.head.append(document.createElement('style'));
		await flush();
		expect(target.head.querySelectorAll('style')).toHaveLength(0);
	});
});

describe('watchWindowClosed', () => {
	afterEach(() => vi.useRealTimers());

	it('fires once on pagehide, then stops', () => {
		const win = new EventTarget() as unknown as Window;
		const onClose = vi.fn();
		watchWindowClosed(win, onClose);
		win.dispatchEvent(new Event('pagehide'));
		win.dispatchEvent(new Event('pagehide'));
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('fires when the window closes without pagehide', () => {
		vi.useFakeTimers();
		const win = Object.assign(new EventTarget(), { closed: false }) as unknown as {
			closed: boolean;
		} & Window;
		const onClose = vi.fn();
		watchWindowClosed(win, onClose, 100);
		vi.advanceTimersByTime(300);
		expect(onClose).not.toHaveBeenCalled();
		win.closed = true;
		vi.advanceTimersByTime(100);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('never fires after its cleanup', () => {
		const win = new EventTarget() as unknown as Window;
		const onClose = vi.fn();
		watchWindowClosed(win, onClose)();
		win.dispatchEvent(new Event('pagehide'));
		expect(onClose).not.toHaveBeenCalled();
	});
});
