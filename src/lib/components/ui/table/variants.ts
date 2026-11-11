import { tv, type VariantProps } from 'tailwind-variants';

export const table = tv({
	slots: {
		container: 'relative w-full overflow-x-auto',
		root: 'w-full caption-bottom text-sm',
		header: '',
		body: '',
		footer: 'font-medium text-muted-foreground',
		row: 'transition-colors',
		head: 'text-left align-middle text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase [&:has([role=checkbox])]:pr-0',
		cell: 'align-middle whitespace-nowrap text-foreground tabular-nums [&:has([role=checkbox])]:pr-0',
		caption: 'mt-4 text-sm text-muted-foreground'
	},
	variants: {
		variant: {
			default: {
				container: 'rounded-xl border border-border bg-card',
				root: 'border-separate border-spacing-0',
				header: 'bg-secondary/50 [&_th]:border-b [&_th]:border-border [&_th]:whitespace-nowrap',
				body: '[&_td]:border-b [&_td]:border-border [&_tr:last-child_td]:border-b-0',
				footer: 'border-t border-border bg-muted/40 tabular-nums [&>tr]:last:border-b-0',
				row: 'hover:bg-accent/60 data-[state=selected]:bg-primary/6'
			},
			// The header sits on a card rim around an inset body, and
			// hairlines split the columns. Separate borders, so cells can round the body corners.
			framed: {
				container: 'rounded-2xl bg-card px-1 pb-1',
				root: 'border-separate border-spacing-0',
				head: 'relative text-xs after:absolute after:end-0 after:top-1/2 after:h-4 after:w-px after:-translate-y-1/2 after:bg-border last:after:hidden',
				body: [
					'[&>tr:not(:last-child)>td]:border-b [&>tr:not(:last-child)>td]:border-border [&>tr>td]:bg-background',
					'[&>tr:first-child>td:first-child]:rounded-tl-xl [&>tr:first-child>td:last-child]:rounded-tr-xl',
					'[&>tr:last-child>td:first-child]:rounded-bl-xl [&>tr:last-child>td:last-child]:rounded-br-xl'
				],
				footer: '[&>tr>td]:pt-2',
				row: '[&>td]:transition-colors hover:[&>td]:bg-card data-[state=selected]:[&>td]:bg-primary/4'
			}
		},
		density: {
			comfortable: { head: 'px-3 py-2', cell: 'px-3 py-2' },
			compact: { head: 'px-3 py-1.5', cell: 'px-3 py-1' }
		}
	},
	defaultVariants: { variant: 'default', density: 'comfortable' }
});

export type TableVariant = NonNullable<VariantProps<typeof table>['variant']>;
export type TableDensity = NonNullable<VariantProps<typeof table>['density']>;
