export type LetterMorphOptions = {
	/** Classes for the glyphs the engine creates, from the tv slot. */
	glyph: string;
};

const NBSP = String.fromCharCode(0xa0);
/** Leaving letters start to clear before the first new letter sharpens in their place. */
const HANDOFF = 50;
const STAGGER = 24;
const MOVE = 'translate var(--duration-spring-snappy) var(--ease-spring-snappy)';
const FADE =
	'opacity 280ms var(--ease-ui-out), scale 280ms var(--ease-ui-out), filter 280ms var(--ease-ui-out)';

/** Letters match by character and occurrence, so the second "i" pairs with the second "i". */
function glyphs(text: string) {
	const seen = new Map<string, number>();
	return Array.from(text).map((char) => {
		const count = seen.get(char) ?? 0;
		seen.set(char, count + 1);
		return { char, key: `${char}-${count}` };
	});
}

/**
 * Morphs `track`'s label into the next in place: shared letters glide to their new spots, new
 * ones sharpen in, removed ones blur away, and `frame`'s width follows.
 */
export function createLetterMorph(
	frame: HTMLElement,
	track: HTMLElement,
	initialText: string,
	initial: LetterMorphOptions
) {
	let options = initial;
	let shown = initialText;
	let nodes = new Map<string, HTMLElement>();
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');

	const make = (char: string, key: string) => {
		const el = document.createElement('span');
		el.dataset.glyph = key;
		el.className = options.glyph;
		el.textContent = char === ' ' ? NBSP : char;
		return el;
	};
	const width = () => track.getBoundingClientRect().width;

	track.replaceChildren();
	for (const { char, key } of glyphs(initialText)) {
		const el = make(char, key);
		nodes.set(key, el);
		track.append(el);
	}
	frame.style.width = `${width()}px`;

	const follow = new ResizeObserver(() => {
		if (!frame.dataset.morphing) frame.style.width = `${width()}px`;
	});
	follow.observe(track);

	return {
		set(text: string) {
			if (text === shown) return;
			shown = text;
			const next = glyphs(text);
			const before = new Map([...nodes].map(([key, el]) => [key, el.offsetLeft]));
			const fromWidth = frame.getBoundingClientRect().width;
			const keep = new Set(next.map((glyph) => glyph.key));
			const animate = !reduced.matches;

			// Leaving letters step out of flow exactly where they were, then blur away.
			for (const [key, el] of nodes) {
				if (keep.has(key)) continue;
				nodes.delete(key);
				if (!animate) {
					el.remove();
					continue;
				}
				el.style.position = 'absolute';
				el.style.left = `${before.get(key) ?? 0}px`;
				el.style.transition = FADE;
				el.style.opacity = '0';
				el.style.scale = '0.86';
				el.style.filter = 'blur(3px)';
				window.setTimeout(() => el.remove(), 300);
			}

			const fresh: HTMLElement[] = [];
			const order: HTMLElement[] = next.map(({ char, key }) => {
				const existing = nodes.get(key);
				if (existing) return existing;
				const el = make(char, key);
				nodes.set(key, el);
				fresh.push(el);
				return el;
			});
			// Place letters in reading order ahead of any leaving ones.
			let anchor: ChildNode | null = track.firstChild;
			for (const el of order) {
				while (
					anchor instanceof HTMLElement &&
					anchor !== el &&
					anchor.style.position === 'absolute'
				)
					anchor = anchor.nextSibling;
				if (anchor !== el) track.insertBefore(el, anchor);
				anchor = el.nextSibling;
			}
			nodes = new Map(next.flatMap((glyph, i) => (order[i] ? [[glyph.key, order[i]]] : [])));

			const toWidth = width();
			if (!animate) {
				frame.style.width = `${toWidth}px`;
				return;
			}
			// FLIP the kept letters from where they were.
			for (const [key, el] of nodes) {
				const from = before.get(key);
				if (from === undefined) continue;
				el.style.transition = 'none';
				el.style.translate = `${from - el.offsetLeft}px 0`;
			}
			const delays = new Map<HTMLElement, number>();
			fresh.forEach((el, i) => {
				el.style.transition = 'none';
				el.style.opacity = '0';
				el.style.scale = '0.8';
				el.style.translate = '0 0.14em';
				el.style.filter = 'blur(3px)';
				delays.set(el, HANDOFF + Math.min(i, 8) * STAGGER);
			});
			frame.dataset.morphing = '';
			frame.style.width = `${fromWidth}px`;
			track.getBoundingClientRect();
			frame.style.width = `${toWidth}px`;
			for (const el of nodes.values()) {
				el.style.transition = `${MOVE}, ${FADE}`;
				el.style.transitionDelay = `${delays.get(el) ?? 0}ms`;
				el.style.translate = '';
				el.style.opacity = '';
				el.style.scale = '';
				el.style.filter = '';
			}
			window.setTimeout(() => {
				delete frame.dataset.morphing;
				for (const el of fresh) el.style.transitionDelay = '';
			}, 700);
		},
		update(next: LetterMorphOptions) {
			options = next;
		},
		destroy() {
			follow.disconnect();
		}
	};
}
