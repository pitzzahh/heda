import { tv, type VariantProps } from 'tailwind-variants';

// The frame carries the animated width; its mask reveals new letters through a soft trailing
// edge. Padding with matching negative margins gives the mask room without changing layout.
export const letterMorph = tv({
	slots: {
		root: '',
		frame: [
			'relative inline-block box-content whitespace-nowrap text-start',
			'-my-[0.5em] -mr-[0.5em] -ml-[0.2em] py-[0.5em] pr-[0.5em] pl-[0.2em]',
			'transition-[width] duration-[var(--duration-spring-snappy)] ease-[var(--ease-spring-snappy)] motion-reduce:transition-none',
			'[mask-image:linear-gradient(90deg,#000_calc(100%-0.5em),transparent)]'
		],
		track: 'relative inline-block whitespace-nowrap',
		glyph: 'inline-block origin-[50%_60%] whitespace-pre'
	},
	variants: {
		variant: {
			default: {},
			mono: { root: 'font-mono' }
		},
		size: {
			inherit: {},
			sm: { root: 'text-lg' },
			default: { root: 'text-3xl' },
			lg: { root: 'text-5xl' }
		}
	},
	defaultVariants: { variant: 'default', size: 'inherit' }
});

export type LetterMorphVariant = NonNullable<VariantProps<typeof letterMorph>['variant']>;
export type LetterMorphSize = NonNullable<VariantProps<typeof letterMorph>['size']>;
