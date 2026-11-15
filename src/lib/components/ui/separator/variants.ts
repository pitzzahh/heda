import { tv, type VariantProps } from 'tailwind-variants';

export const separator = tv({
	base: 'shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch',
	variants: {
		variant: {
			solid: 'bg-border',
			dashed:
				'border-dashed border-border bg-transparent data-[orientation=horizontal]:border-t data-[orientation=vertical]:border-l'
		}
	},
	defaultVariants: { variant: 'solid' }
});

export type SeparatorVariant = NonNullable<VariantProps<typeof separator>['variant']>;
