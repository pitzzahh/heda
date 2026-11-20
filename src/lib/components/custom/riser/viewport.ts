/** Pan and zoom of the riser diagram: screen = content × k + (x, y). */
export type View = { x: number; y: number; k: number };

// Low enough that Fit shows a site of a thousand panels (about 300 000 px across).
export const MIN_ZOOM = 0.002;
export const MAX_ZOOM = 4;

const clamp = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/** Zooms by `factor` keeping the content point under (px, py) in place. */
export function zoomAt(view: View, factor: number, px: number, py: number): View {
	const k = clamp(view.k * factor);
	const ratio = k / view.k;
	return { k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/** The whole diagram in view, never enlarged past 100 %, centred across and top-aligned. */
export function fitView(
	content: { width: number; height: number },
	frame: { width: number; height: number },
	padding = 16
): View {
	const k = clamp(
		Math.min(
			(frame.width - padding * 2) / content.width,
			(frame.height - padding * 2) / content.height,
			1
		)
	);
	return { k, x: (frame.width - content.width * k) / 2, y: padding };
}

/** Below this zoom the text is too small to read, so the diagram drops it. */
export const DETAIL_ZOOM = 0.35;

export type Rect = { left: number; top: number; right: number; bottom: number };

/** The content area the frame shows, widened by `overscan` screen pixels each side. */
export function visibleRect(
	view: View,
	frame: { width: number; height: number },
	overscan = 200
): Rect {
	return {
		left: (-view.x - overscan) / view.k,
		top: (-view.y - overscan) / view.k,
		right: (frame.width - view.x + overscan) / view.k,
		bottom: (frame.height - view.y + overscan) / view.k
	};
}
