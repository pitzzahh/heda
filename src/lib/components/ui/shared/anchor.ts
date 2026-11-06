import { tv } from 'tailwind-variants';

// Keyframe animations (tw-animate-css), never @starting-style transitions: keyframes
// apply on the mount frame in every engine, so floating content never flashes
// unpositioned while bits-ui measures it. Content stays `static` inside bits-ui's
// fixed Positioner wrapper, which owns the placement transform.

/**
 * Class contract every anchored surface shares, so a popover, a menu, a select and a
 * tooltip open and close identically. bits-ui only sets the origin variable, so apply it here.
 */
export const ANCHORED = tv({
	base: [
		'z-50 pointer-events-none',
		// bits-ui sets data-starting-style for the mount frame only: hide it so a
		// late animation start or an unmeasured position can never flash. Keep the
		// `data-starting-style:` variant: the bare `[data-starting-style]:` form
		// compiles to a no-op `:is()` selector.
		'data-starting-style:opacity-0',
		'data-[state=open]:pointer-events-auto',
		// Plain `ease`: fast in, instant out.
		'data-[state=open]:animate-in data-[state=closed]:animate-out',
		// Exit values (fade/zoom out) sit outside `data-state=closed`: the flip and
		// the exit animation share one style recalc, and WebKitGTK can resolve
		// keyframe custom properties from the pre-flip style, which left the surface
		// opaque on close. They only ever feed the exit animation.
		'data-[state=open]:fade-in-0 fade-out-0',
		'data-[state=open]:zoom-in-95 zoom-out-95',
		// Hold the exit end state through bits-ui's unmount gap; with the default
		// `none` the surface snaps back to full opacity for a frame or two.
		'data-[state=closed]:fill-mode-forwards',
		'data-[state=open]:duration-[var(--duration-dropdown)] data-[state=closed]:duration-[var(--duration-exit)]',
		'ease-[var(--ease-smooth)]',
		// The closed state leans toward its trigger, so opening reads as unfolding from it.
		// `side` is bits-ui's own popper attribute.
		'data-[side=bottom]:slide-in-from-top-2',
		'data-[side=top]:slide-in-from-bottom-2',
		'data-[side=left]:slide-in-from-end-2',
		'data-[side=right]:slide-in-from-start-2',
		'origin-(--bits-floating-transform-origin)',
		'motion-reduce:animate-none'
	]
})();
