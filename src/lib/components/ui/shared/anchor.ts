import { tv } from 'tailwind-variants';

// `fixed top-0 left-0` needs a Base UI/bits-ui Positioner wrapper's content back to
// `static`, or it can't measure it.
const ANCHORED_BASE = [
	'fixed top-0 left-0 z-50 pointer-events-none opacity-0',
	// Plain `ease`: 150ms in, 100ms out.
	'duration-[var(--duration-exit)] ease-[var(--ease-smooth)]',
	'data-[state=open]:pointer-events-auto data-[state=open]:opacity-100',
	'data-[state=open]:duration-[var(--duration-dropdown)]',
	// The first open mounts the element already open, so only @starting-style can animate it.
	'starting:data-[state=open]:opacity-0',
	'motion-reduce:transition-none'
];

/**
 * Class contract every anchored surface shares, so a popover, a menu and a select
 * open and close identically. bits-ui only sets the origin variable, so apply it here.
 */
export const ANCHORED = tv({
	base: [
		...ANCHORED_BASE,
		'origin-(--bits-floating-transform-origin) scale-[var(--popover-exit-scale)] transition-[opacity,scale,translate]',
		// The closed state leans toward its trigger, so opening reads as unfolding from it.
		// `side` is bits-ui's own popper attribute.
		'data-[state=closed]:data-[placement^=bottom]:-translate-y-1',
		'data-[state=closed]:data-[placement^=top]:translate-y-1',
		'data-[state=closed]:data-[side=bottom]:-translate-y-1',
		'data-[state=closed]:data-[side=top]:translate-y-1',
		'data-[state=open]:scale-100',
		'starting:data-[state=open]:scale-[var(--popover-enter-scale)]',
		'starting:data-[state=open]:data-[placement^=bottom]:-translate-y-1',
		'starting:data-[state=open]:data-[placement^=top]:translate-y-1',
		'starting:data-[state=open]:data-[side=bottom]:-translate-y-1',
		'starting:data-[state=open]:data-[side=top]:translate-y-1',
		// Side placements lean toward the trigger too.
		'data-[state=closed]:data-[side=left]:translate-x-1 data-[state=closed]:data-[side=right]:-translate-x-1',
		'starting:data-[state=open]:data-[side=left]:translate-x-1 starting:data-[state=open]:data-[side=right]:-translate-x-1'
	]
})();
