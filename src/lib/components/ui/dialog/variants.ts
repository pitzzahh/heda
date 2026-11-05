import { tv, type VariantProps } from 'tailwind-variants';

/**
 * Shared modal contract: Dialog, AlertDialog and Command frame the same way. Enter/exit
 * are keyframe animations (tw-animate-css): they apply on the mount frame in every
 * engine, unlike @starting-style transitions. Centering lives on the `translate`
 * property so keyframe `transform`s compose with it instead of overriding it.
 */
export const dialogFrame = tv({
	slots: {
		// Fades in step with the panel; the primitive owns the top layer and inertness.
		backdrop: [
			'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]',
			'data-[state=open]:animate-in data-[state=closed]:animate-out',
			'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
			'data-[state=open]:duration-[var(--duration-dropdown)] data-[state=closed]:duration-[var(--duration-exit)]',
			'ease-[var(--ease-ui-out)]',
			'motion-reduce:animate-none'
		],
		// Motion is selected by the root; every path retraces itself on close.
		popup: [
			'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 overflow-visible outline-hidden',
			'motion-reduce:animate-none'
		],
		panel: 'rounded-2xl border border-border/70 shadow-[var(--overlay-shadow)]',
		// The icon-only close in the corner; a close with children styles itself.
		close:
			'absolute top-3 right-3 grid size-8 place-items-center rounded-md text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
		footer: 'flex items-center justify-end gap-2',
		body: 'relative overflow-hidden'
	},
	variants: {
		motion: {
			zoom: {
				popup: [
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
					'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
					'duration-[var(--duration-overlay)] data-[state=closed]:duration-[var(--duration-exit)]',
					'ease-[var(--ease-out-quad)]'
				]
			},
			fade: {
				popup: [
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
					'duration-[var(--duration-overlay)] data-[state=closed]:duration-[var(--duration-exit)]',
					'ease-[var(--ease-out-quad)]'
				]
			},
			'slide-up': {
				popup: [
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
					'data-[state=open]:slide-in-from-bottom-6 data-[state=closed]:slide-out-to-bottom-6',
					'duration-[var(--duration-overlay)] data-[state=closed]:duration-[var(--duration-exit)]',
					'ease-[var(--ease-out-quad)]'
				]
			},
			'slide-down': {
				popup: [
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
					'data-[state=open]:slide-in-from-top-6 data-[state=closed]:slide-out-to-top-6',
					'duration-[var(--duration-overlay)] data-[state=closed]:duration-[var(--duration-exit)]',
					'ease-[var(--ease-out-quad)]'
				]
			},
			'slide-left': {
				popup: [
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
					'data-[state=open]:slide-in-from-end-6 data-[state=closed]:slide-out-to-end-6',
					'duration-[var(--duration-overlay)] data-[state=closed]:duration-[var(--duration-exit)]',
					'ease-[var(--ease-out-quad)]'
				]
			},
			'slide-right': {
				popup: [
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
					'data-[state=open]:slide-in-from-start-6 data-[state=closed]:slide-out-to-start-6',
					'duration-[var(--duration-overlay)] data-[state=closed]:duration-[var(--duration-exit)]',
					'ease-[var(--ease-out-quad)]'
				]
			},
			// Clip-path has no keyframe utility: the collapse stays a transition (exits
			// never needed @starting-style), while the fade rides the keyframes.
			morph: {
				popup: [
					'data-[state=open]:animate-in data-[state=closed]:animate-out',
					'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
					'[clip-path:inset(0_0_0_0_round_var(--radius-2xl))] transition-[clip-path] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)] will-change-[clip-path]',
					'data-[state=closed]:[clip-path:inset(48%_48%_48%_48%_round_var(--radius-2xl))]',
					'motion-reduce:[clip-path:none] motion-reduce:will-change-auto'
				]
			}
		},
		variant: {
			// The rim is the card surface; a hairline, not a lighter shade, lifts the body off it.
			framed: {
				panel: 'bg-card p-1',
				footer: 'px-2 pt-2 pb-1',
				body: 'rounded-xl border border-border bg-popover p-5'
			},
			default: { panel: 'bg-popover p-6', footer: 'pt-6', body: '' }
		}
	},
	defaultVariants: { motion: 'zoom', variant: 'default' }
});

export type DialogVariant = NonNullable<VariantProps<typeof dialogFrame>['variant']>;
export type DialogMotion = NonNullable<VariantProps<typeof dialogFrame>['motion']>;

/** Dialog-only: AlertDialog and Command set their own fixed panel width. */
export const dialogWidth = tv({
	variants: {
		size: {
			sm: 'max-w-sm',
			default: 'max-w-lg',
			lg: 'max-w-2xl',
			xl: 'max-w-4xl'
		}
	},
	defaultVariants: { size: 'default' }
});

export type DialogSize = NonNullable<VariantProps<typeof dialogWidth>['size']>;
