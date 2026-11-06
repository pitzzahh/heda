import { tv, type VariantProps } from 'tailwind-variants';

/** Slides in, out the way it came; the scrim lands first and leaves with the panel. Keyframes, never @starting-style: they apply on the mount frame in every engine. */
export const sheet = tv({
	slots: {
		backdrop: [
			'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]',
			// The mount frame is hidden for the scrim too, so a late animation start
			// never flashes the full-strength backdrop.
			'data-starting-style:opacity-0',
			'data-[state=open]:animate-in data-[state=closed]:animate-out',
			// The exit value sits outside `data-state=closed`: the flip and the exit
			// animation share one style recalc, and WebKitGTK can resolve keyframe
			// custom properties from the pre-flip style, leaving the scrim opaque.
			'data-[state=open]:fade-in-0 fade-out-0',
			// Hold the faded-out scrim through bits-ui's unmount gap, or it flashes
			// back to full strength for a frame before the element is removed.
			'data-[state=closed]:fill-mode-forwards',
			'data-[state=open]:duration-[var(--duration-backdrop)] data-[state=closed]:duration-[var(--duration-panel-exit)]',
			'ease-[var(--ease-drawer)]',
			'motion-reduce:animate-none'
		],
		body: '',
		panel: [
			'fixed z-50 flex flex-col shadow-(--overlay-shadow)',
			// bits-ui sets data-starting-style for the mount frame only: hide it so a
			// late animation start can never flash the panel at full opacity.
			'data-starting-style:opacity-0',
			// Hold the exit end state through bits-ui's unmount gap.
			'data-[state=closed]:fill-mode-forwards',
			'data-[state=open]:animate-in data-[state=closed]:animate-out',
			'duration-[var(--duration-overlay)] data-[state=closed]:duration-[var(--duration-panel-exit)]',
			'ease-[var(--ease-drawer)]',
			// Slide values are `data-side` scoped, so they are stable from mount.
			'data-[side=left]:slide-in-from-left data-[side=left]:slide-out-to-left',
			'data-[side=right]:slide-in-from-right data-[side=right]:slide-out-to-right',
			'data-[side=top]:slide-in-from-top data-[side=top]:slide-out-to-top',
			'data-[side=bottom]:slide-in-from-bottom data-[side=bottom]:slide-out-to-bottom',
			'motion-reduce:animate-none'
		]
	},
	variants: {
		// Framed matches Dialog and Drawer: a card-step rim around a bordered popover body.
		variant: {
			default: {
				panel: 'gap-4 overflow-y-auto bg-popover p-6',
				body: 'contents'
			},
			framed: {
				panel: 'bg-card p-1',
				body: 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-[11px] border border-border bg-popover p-5'
			}
		},
		side: {
			left: { panel: 'inset-y-0 left-0 h-full w-[min(22rem,100vw)]' },
			right: { panel: 'inset-y-0 right-0 h-full w-[min(22rem,100vw)]' },
			top: { panel: 'inset-x-0 top-0 w-full max-h-[80vh]' },
			bottom: { panel: 'inset-x-0 bottom-0 w-full max-h-[80vh] rounded-t-2xl' }
		}
	},
	compoundVariants: [
		{ variant: 'framed', side: 'left', class: { body: 'rounded-l-none' } },
		{ variant: 'framed', side: 'right', class: { body: 'rounded-r-none' } },
		{ variant: 'framed', side: 'top', class: { body: 'rounded-t-none' } },
		{ variant: 'framed', side: 'bottom', class: { body: 'rounded-b-none' } }
	],
	defaultVariants: { variant: 'default', side: 'right' }
});

export type SheetVariant = NonNullable<VariantProps<typeof sheet>['variant']>;

export type SheetSide = NonNullable<VariantProps<typeof sheet>['side']>;
