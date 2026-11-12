import { tv, type VariantProps } from 'tailwind-variants';

export const commandFrame = tv({
	slots: {
		popup: [
			'fixed top-[14vh] left-1/2 z-50 -translate-x-1/2 outline-hidden',
			'transition-[opacity,scale] duration-[var(--duration-overlay)] ease-[var(--ease-out-quad)]',
			'data-[state=closed]:scale-[var(--popover-exit-scale)] data-[state=closed]:opacity-0 data-[state=closed]:duration-[var(--duration-exit)]',
			'starting:data-[state=open]:scale-[var(--modal-enter-scale)] starting:data-[state=open]:opacity-0',
			'flex max-h-[min(30rem,70dvh)] w-[min(36rem,calc(100vw-2rem))] flex-col overflow-hidden',
			'motion-reduce:transition-none'
		],
		panel: '',
		body: 'relative flex min-h-0 flex-col overflow-hidden text-foreground',
		header: 'flex items-center justify-between gap-3 px-3.5',
		bar: 'flex shrink-0 items-center gap-2',
		inputWrap: 'flex shrink-0 items-center gap-2',
		inputIcon: 'size-4 shrink-0 text-muted-foreground',
		input:
			'w-full min-w-0 bg-transparent text-foreground outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
		count: 'hidden',
		kbd: 'inline-flex h-5 min-w-5 shrink-0 items-center justify-center gap-0.5 rounded-md bg-foreground/6 px-1.5 font-sans text-xs font-medium text-muted-foreground transition-[translate,background-color,color] duration-(--duration-instant) ease-[var(--ease-ui-out)] data-[pressed]:translate-y-px data-[pressed]:bg-foreground/8 data-[pressed]:text-foreground motion-reduce:transition-none',
		filters: 'relative flex shrink-0 items-center border-0 bg-transparent p-0',
		pill: 'pointer-events-none absolute top-0 left-0 data-[ready]:transition-[translate,width,height] data-[ready]:duration-(--duration-slow) data-[ready]:ease-[var(--ease-ui-out)] motion-reduce:transition-none',
		filter: [
			'relative z-10 inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 font-medium text-muted-foreground outline-hidden data-[pressed]:bg-transparent data-[state=on]:bg-transparent',
			'transition-[color,background-color] duration-(--duration-fast) ease-[var(--ease-ui-out)] hover:text-foreground',
			'focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0'
		],
		list: 'scroll-area relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain',
		// cmdk renders the heading itself, so React styles it through the group; Svelte uses groupHeading.
		group:
			'[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
		groupHeading: 'text-xs font-medium text-muted-foreground',
		groupItems: '',
		// cmdk writes data-selected="true"/"false"; bits-ui writes a bare attribute.
		item: [
			'relative flex w-full cursor-default items-center gap-2 text-left text-sm outline-hidden select-none',
			"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
			'data-[disabled=""]:pointer-events-none data-[disabled=""]:opacity-50 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50'
		],
		// One marker for the active row. It snaps: arrow keys repeat too fast for motion to help.
		marker:
			'pointer-events-none absolute top-0 left-0 data-[glide]:transition-[translate,width,height] data-[glide]:duration-(--duration-fast) data-[glide]:ease-[var(--ease-ui-out)] motion-reduce:transition-none',
		empty: 'text-center text-sm text-muted-foreground',
		shortcut: 'ml-auto shrink-0 text-xs tracking-widest text-muted-foreground',
		separator: '-mx-1 h-px border-0 bg-border',
		footer: 'flex shrink-0 items-center justify-between gap-4 text-xs text-muted-foreground',
		hint: 'flex items-center gap-1.5'
	},
	variants: {
		/** `framed` adds a rim; `launcher` pairs pill search with filters; `spotlight` is input under chips. */
		variant: {
			default: {
				panel: 'rounded-xl border border-border bg-popover shadow-(--overlay-shadow)',
				body: 'rounded-xl bg-popover p-1',
				inputWrap: 'mx-1 mt-1 h-8 rounded-lg bg-foreground/4 px-2',
				inputIcon: 'opacity-50',
				input: 'h-8 text-sm',
				list: 'h-[var(--cmdk-list-height,var(--bits-command-list-height,auto))] max-h-72 flex-none scroll-py-1 transition-[height] duration-(--duration-base) ease-(--ease-ui-out) motion-reduce:transition-none',
				group: 'p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
				groupHeading: 'px-2 py-1.5',
				item: [
					'rounded-xs px-2 py-1.5',
					'data-[selected=""]:bg-foreground/6 data-[selected=true]:bg-foreground/6 data-[selected=""]:[&_svg]:text-foreground data-[selected=true]:[&_svg]:text-foreground'
				],
				marker: 'hidden',
				empty: 'py-6',
				footer: 'border-t border-border px-3 py-2'
			},
			framed: {
				panel: 'rounded-2xl border border-border bg-background p-1 shadow-(--overlay-shadow)',
				header: 'pt-1.5 pb-2',
				body: 'rounded-[11px] border border-border bg-popover',
				inputWrap: 'border-b border-border px-3',
				input: 'h-12 text-sm',
				count:
					'block min-w-[2ch] shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums',
				list: 'py-1.5',
				groupHeading: 'px-4 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase',
				group:
					'[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-items]]:px-1.5',
				groupItems: 'px-1.5',
				item: [
					'justify-between gap-3 rounded-lg px-2.5 py-2 text-muted-foreground',
					'transition-[color,scale] [transition-duration:var(--duration-instant),var(--duration-slow)] ease-[var(--ease-out-quart)] active:scale-[var(--press-scale-row)] motion-reduce:transition-none',
					'data-[selected=""]:text-foreground data-[selected=true]:text-foreground'
				],
				marker: 'rounded-md bg-foreground/6',
				empty: 'px-4 py-10',
				footer: 'border-t border-border px-4 py-2'
			},
			launcher: {
				popup: 'w-[min(42rem,calc(100vw-2rem))]',
				panel: 'rounded-3xl border border-border bg-card p-3 shadow-(--overlay-shadow)',
				body: 'gap-3',
				bar: 'flex-wrap sm:flex-nowrap',
				inputWrap: 'h-11 min-w-48 flex-1 rounded-full border border-border bg-background px-4',
				input: 'h-11 text-sm',
				// Matches the h-11 input: 1px border + 3px padding round the h-9 filters is 44px.
				filters: 'h-11 gap-0.5 rounded-full border border-border bg-background p-[3px]',
				pill: 'rounded-full bg-foreground/6',
				filter:
					'size-9 rounded-full data-[pressed]:text-foreground data-[state=on]:text-foreground',
				list: 'rounded-2xl border border-border bg-background p-1.5',
				kbd: 'h-auto min-w-0 bg-transparent px-0',
				group:
					'[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5',
				groupHeading: 'px-2.5 pt-2 pb-1.5',
				item: [
					'gap-3 rounded-xl px-2.5 py-2.5 text-sm text-muted-foreground',
					'transition-[color,scale] [transition-duration:var(--duration-instant),var(--duration-fast)] ease-[var(--ease-ui-out)] active:scale-[0.99] motion-reduce:transition-none',
					'data-[selected=""]:text-foreground data-[selected=true]:text-foreground'
				],
				marker: 'rounded-xl bg-foreground/6',
				empty: 'py-10',
				footer: 'px-2 pt-0.5'
			},
			spotlight: {
				popup: 'w-[min(46rem,calc(100vw-2rem))]',
				panel: 'rounded-2xl border border-border bg-popover p-2 shadow-(--overlay-shadow)',
				filters: 'gap-1 self-start px-1 pt-1',
				pill: 'rounded-full bg-foreground/8',
				filter:
					'h-7 rounded-full px-3 text-xs data-[pressed]:text-foreground data-[state=on]:text-foreground',
				inputWrap: 'h-14 gap-3 px-3',
				inputIcon: 'size-5',
				input: 'h-14 text-lg',
				kbd: 'h-7 rounded-lg border-transparent bg-foreground/6 px-2 text-xs',
				list: 'border-t border-border pt-1.5',
				group:
					'[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1',
				groupHeading: 'px-3 pt-2 pb-1',
				item: [
					'gap-3 rounded-lg px-3 py-2.5 text-base transition-[scale] duration-(--duration-fast) ease-[var(--ease-ui-out)] active:scale-[0.99] motion-reduce:transition-none',
					"[&_svg]:text-foreground [&_svg:not([class*='size-'])]:size-[18px]"
				],
				marker: 'rounded-lg bg-foreground/8',
				empty: 'py-10',
				footer: 'border-t border-border px-3 pt-2 pb-1'
			}
		}
	},
	defaultVariants: { variant: 'default' }
});

export type CommandVariant = NonNullable<VariantProps<typeof commandFrame>['variant']>;
