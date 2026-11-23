/** Offset box of the pressed option, for an indicator that slides between options. */
export type PillBox = { x: number; y: number; w: number; h: number };

/** `el`'s box relative to its offset parent, the indicator's positioning context. */
export function offsetBox(el: HTMLElement): PillBox {
	return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}

/** Inline style that places the indicator; hidden until an option is pressed. */
export function pillStyle(box: PillBox | null): Record<string, string> {
	if (!box) return { opacity: '0' };
	return {
		translate: `${box.x}px ${box.y}px`,
		width: `${box.w}px`,
		height: `${box.h}px`
	};
}
