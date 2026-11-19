import type { RiserBox, RiserItems, RiserLayout } from '#lib/types/riser.js';
import type { Rect } from './viewport.js';

/**
 * Drawing helpers for the riser diagram the engine lays out (`crates/heda-core/src/riser.rs`).
 * These sizes are the engine's and must match it.
 */
export const LINE = 16;
/** The circuit breaker symbol (Appendix A 1.11), from the top of its gap in the feeder. */
export const BREAKER_HEIGHT = 22;
/** Height of the transformer symbol (Appendix A 3.1), leads included. */
export const TRANSFORMER_HEIGHT = 40;

/** Widest a feeder label runs from its x (five lines of about 40 characters at 11 px). */
const LABEL_WIDTH = 240;

/** Everything of the layout that falls in `rect`; all of it when `rect` is omitted. */
export function visibleItems(layout: RiserLayout, rect?: Rect): RiserItems {
	if (!rect) return layout;
	const within = (left: number, top: number, right: number, bottom: number) =>
		right >= rect.left && left <= rect.right && bottom >= rect.top && top <= rect.bottom;
	return {
		boxes: layout.boxes.filter((b) => within(b.x, b.y, b.x + b.width, b.y + b.height)),
		labels: layout.labels.filter((l) =>
			within(l.x, l.y - LINE, l.x + LABEL_WIDTH, l.y + LINE * l.lines.length)
		),
		breakers: layout.breakers.filter(([x, y]) => within(x - 12, y, x + 12, y + BREAKER_HEIGHT)),
		ticks: layout.ticks.filter((t) => within(t.x - 6, t.y - 4, t.x + 6, t.y + t.count * 5))
	};
}

/** Every wire as one path, so the browser draws them as a single element. */
export function wirePath(wires: RiserLayout['wires']): string {
	return wires
		.map((wire) => wire.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(''))
		.join('');
}

/** Every panelboard outline as one path, for the zoomed-out view. */
export function boxPath(boxes: RiserBox[]): string {
	return boxes.map((b) => `M${b.x} ${b.y}h${b.width}v${b.height}h${-b.width}Z`).join('');
}
