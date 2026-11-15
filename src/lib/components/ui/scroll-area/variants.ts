import { tv, type VariantProps } from 'tailwind-variants';

export const scrollArea = tv({
	slots: {
		root: 'relative overflow-hidden',
		viewport: 'size-full overscroll-contain rounded-[inherit] outline-hidden'
	},
	variants: {
		scrollbar: {
			auto: {},
			hidden: {
				viewport:
					'[scrollbar-width:none] [scrollbar-gutter:auto] overflow-x-hidden! overflow-y-auto! [&::-webkit-scrollbar]:hidden'
			}
		}
	},
	defaultVariants: { scrollbar: 'auto' }
});

export type ScrollAreaScrollbar = NonNullable<VariantProps<typeof scrollArea>['scrollbar']>;
