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

	it('copies stylesheets and the theme root attributes', () => {
		document.head.innerHTML = '<style>.a{color:red}</style><title>x</title>';
		document.documentElement.className = 'dark';
		document.documentElement.style.setProperty('--primary', 'blue');

		stop = mirrorDocumentStyles(document, target);

		expect(target.head.querySelector('style')?.textContent).toBe('.a{color:red}');
		expect(target.title).toBe('popout');
		expect(target.documentElement.className).toBe('dark');
		expect(target.documentElement.style.getPropertyValue('--primary')).toBe('blue');
	});

	it('inlines linked stylesheets once they load, with urls resolved against the sheet', () => {
		document.head.innerHTML = '<link rel="stylesheet" href="/assets/app.css" media="print">';
		const link = document.head.querySelector('link')!;
		let sheet: { cssRules: { cssText: string }[] } | null = null;
		Object.defineProperty(link, 'sheet', { get: () => sheet });
		stop = mirrorDocumentStyles(document, target);
		expect(target.head.querySelector('style')).toBeNull();

		sheet = {
			cssRules: [
				{ cssText: '.a { color: red; }' },
				{ cssText: '@font-face { src: url("./f.woff2") format("woff2"); }' },
				{ cssText: '.m { mask: url("#m"); background: url("data:image/gif;base64,R0=="); }' }
			]
		};
		link.dispatchEvent(new Event('load'));

		const style = target.head.querySelector('style');
		const font = new URL('/assets/f.woff2', document.baseURI).href;
		expect(target.head.querySelector('link')).toBeNull();
		expect(style?.textContent).toBe(
			'.a { color: red; }\n' +
				`@font-face { src: url("${font}") format("woff2"); }\n` +
				'.m { mask: url("#m"); background: url("data:image/gif;base64,R0=="); }'
		);
		expect(style?.media).toBe('print');
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
