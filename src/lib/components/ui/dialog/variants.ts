import { tv, type VariantProps } from 'tailwind-variants';

/**
 * Shared modal contract, no keyframes: WebKitGTK intermittently resolved keyframe
 * custom properties from the pre-flip style, closing surfaces without fading.
 */
export const dialogFrame = tv({
	slots: {
		// Fades in step with the panel; the primitive owns the top layer and inertness.
		// No backdrop blur: a full-viewport filter re-rendered every frame is the one
		// genuinely expensive effect an overlay can carry.
		backdrop: [
			'fixed inset-0 z-50 bg-black/50 opacity-0',
			'transition-opacity duration-[var(--duration-exit)] ease-[var(--ease-ui-out)]',
			'data-[state=open]:opacity-100 data-[state=open]:duration-[var(--duration-dropdown)]',
			'starting:data-[state=open]:opacity-0',
			'motion-reduce:transition-none'
		],
		// Motion is selected by the root; every path retraces itself on close.
		popup: [
			'fixed top-1/2 left-1/2 z-50 overflow-visible outline-hidden',
			'[transform:translate(-50%,-50%)_translate(var(--dialog-x,0),var(--dialog-y,0))_scale(var(--dialog-scale,1))]',
			'data-starting-style:opacity-0',
			'motion-reduce:transition-none'
		],
		// The top hairline catches the light like the edge of a drafting sheet.
		// No `relative` here: it would merge over the popup's `fixed` via `cn`.
		panel: [
			'rounded-2xl border border-border/70 shadow-[var(--overlay-shadow)]',
			"before:pointer-events-none before:absolute before:inset-x-7 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-foreground/10 before:to-transparent before:content-['']"
		],
		// The icon-only close in the corner; a close with children styles itself.
		close:
			'absolute top-4 right-4 z-20 grid size-8 place-items-center rounded-full text-muted-foreground outline-hidden transition-[color,background-color,scale] duration-[var(--duration-fast)] ease-[var(--ease-smooth)] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none max-lg:top-3 max-lg:right-3',
		header: 'mb-4 flex shrink-0 flex-col gap-2 pr-10 max-lg:mb-3 max-lg:gap-1 max-lg:pr-9',
		footer: 'flex shrink-0 items-center justify-end gap-2',
		body: 'relative overflow-hidden max-lg:flex max-lg:min-h-0 max-lg:flex-col',
		// Drawers scroll only this middle; the header sits above it and the footer below it.
		scroll: 'max-lg:min-h-0 max-lg:flex-1 max-lg:overflow-y-auto max-lg:overscroll-contain',
		// Phones and tablets (below lg): a bottom drawer instead of a centred dialog.
		// Important, so call-site widths (`sm:max-w-md`, …) only shape the desktop dialog.
		drawer: [
			'max-lg:top-auto! max-lg:bottom-0! max-lg:left-0! max-lg:w-full! max-lg:max-w-none!',
			'max-lg:flex! max-lg:max-h-[92dvh]! max-lg:flex-col! max-lg:overflow-hidden!',
			'max-lg:rounded-t-2xl! max-lg:rounded-b-none! max-lg:border-x-0! max-lg:border-b-0!',
			'max-lg:[transform:translateY(var(--drawer-y,0))]! max-lg:[clip-path:none]!',
			// Phone GPUs: a layer ready before the slide, and one light shadow instead of the
			// four-layer dialog shadow, which is costly to paint across a full-width sheet.
			'max-lg:shadow-[0_-8px_24px_-8px_rgb(0_0_0/0.18)]! max-lg:will-change-transform',
			'max-lg:transition-[opacity,transform]! max-lg:duration-[var(--duration-overlay)] max-lg:ease-[var(--ease-drawer)]',
			'max-lg:data-[state=closed]:[--drawer-y:100%] max-lg:starting:data-[state=open]:[--drawer-y:100%]'
		]
	},
	variants: {
		motion: {
			zoom: {
				popup: [
					'transition-[opacity,transform] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)]',
					'data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--duration-exit)] data-[state=closed]:[--dialog-scale:var(--modal-enter-scale)]',
					'starting:data-[state=open]:opacity-0 starting:data-[state=open]:[--dialog-scale:var(--modal-enter-scale)]'
				]
			},
			fade: {
				popup: [
					'transition-[opacity,transform] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)]',
					'data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--duration-exit)] data-[state=closed]:[--dialog-scale:0.99]',
					'starting:data-[state=open]:opacity-0 starting:data-[state=open]:[--dialog-scale:0.99]'
				]
			},
			'slide-up': {
				popup: [
					'transition-[opacity,transform] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)]',
					'data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--duration-exit)] data-[state=closed]:[--dialog-y:1.5rem]',
					'starting:data-[state=open]:opacity-0 starting:data-[state=open]:[--dialog-y:1.5rem]'
				]
			},
			'slide-down': {
				popup: [
					'transition-[opacity,transform] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)]',
					'data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--duration-exit)] data-[state=closed]:[--dialog-y:-1.5rem]',
					'starting:data-[state=open]:opacity-0 starting:data-[state=open]:[--dialog-y:-1.5rem]'
				]
			},
			'slide-left': {
				popup: [
					'transition-[opacity,transform] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)]',
					'data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--duration-exit)] data-[state=closed]:[--dialog-x:1.5rem]',
					'starting:data-[state=open]:opacity-0 starting:data-[state=open]:[--dialog-x:1.5rem]'
				]
			},
			'slide-right': {
				popup: [
					'transition-[opacity,transform] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)]',
					'data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--duration-exit)] data-[state=closed]:[--dialog-x:-1.5rem]',
					'starting:data-[state=open]:opacity-0 starting:data-[state=open]:[--dialog-x:-1.5rem]'
				]
			},
			// Clip-path has no interpolable state lever that reads well, so the collapse
			// stays a transition and the panel stays opaque while folding to its centre.
			morph: {
				popup: [
					'transition-[clip-path] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)] will-change-[clip-path] [clip-path:inset(0_0_0_0_round_var(--radius-2xl))]',
					'data-[state=closed]:[clip-path:inset(48%_48%_48%_48%_round_var(--radius-2xl))]',
					'starting:data-[state=open]:[clip-path:inset(48%_48%_48%_48%_round_var(--radius-2xl))]',
					'motion-reduce:will-change-auto motion-reduce:[clip-path:none]'
				]
			}
		},
		variant: {
			framed: {
				panel: 'bg-card p-1',
				footer: 'px-2 pt-2 pb-1',
				body: 'rounded-xl border border-border bg-popover p-5 max-lg:p-4'
			},
			default: {
				// Drawers trade the desktop margins for room: space is tight on a phone.
				panel: 'bg-popover p-6 max-lg:p-4',
				// Full-bleed action bar: the negative margins cancel the panel padding.
				footer: [
					'-mx-6 mt-6 -mb-6 rounded-b-2xl border-t border-border/60 bg-muted/25 px-6 py-4',
					'max-lg:-mx-4 max-lg:mt-4 max-lg:-mb-4 max-lg:px-4 max-lg:py-3'
				],
				body: ''
			}
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
