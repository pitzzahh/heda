import { tv, type VariantProps } from 'tailwind-variants';

// One eye that a slash draws across, cutting the outline beneath it, instead of swapping icons.
export const passwordInput = tv({
	slots: {
		root: 'flex w-full flex-col gap-2',
		toggle:
			'grid size-7 place-items-center rounded-md text-muted-foreground outline-hidden hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4.5',
		slash:
			'transition-[stroke-dashoffset,opacity] duration-[var(--duration-base)] ease-[var(--ease-ui-out)] [stroke-dasharray:1] [stroke-dashoffset:1] opacity-0 group-data-[revealed=true]/toggle:opacity-100 group-data-[revealed=true]/toggle:[stroke-dashoffset:0] motion-reduce:transition-none',
		meter: 'flex items-center gap-3',
		segments: 'grid flex-1 grid-cols-4 gap-1',
		segment:
			'h-1 rounded-full bg-muted transition-[background-color] duration-[var(--duration-base)] ease-[var(--ease-ui-out)] motion-reduce:transition-none',
		word: 'min-w-16 text-right font-medium text-muted-foreground text-xs',
		rules: 'grid gap-1 text-muted-foreground text-xs',
		rule: 'flex items-center gap-2 transition-colors duration-[var(--duration-fast)] data-[met=true]:text-foreground',
		tick: 'menu-check size-3.5 shrink-0 text-success',
		dot: 'size-1 rounded-full bg-current'
	},
	variants: {
		// The filled segments take the tone of the current step.
		level: {
			0: {},
			1: { segment: 'data-[on=true]:bg-destructive' },
			2: { segment: 'data-[on=true]:bg-warning' },
			3: { segment: 'data-[on=true]:bg-info' },
			4: { segment: 'data-[on=true]:bg-success' }
		}
	},
	defaultVariants: { level: 0 }
});

export type PasswordStrengthStep = NonNullable<VariantProps<typeof passwordInput>['level']>;
