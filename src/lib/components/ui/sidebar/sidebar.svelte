<script lang="ts">
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { cn } from '#lib/utils/index.js';
	import type { WithElementRef } from 'bits-ui';
	import type { HTMLAttributes } from 'svelte/elements';
	import { SIDEBAR_WIDTH_MOBILE } from './constants.js';
	import { useSidebar } from './context.svelte.js';

	let {
		ref = $bindable(null),
		side = 'left',
		variant = 'sidebar',
		collapsible = 'offcanvas',
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		side?: 'left' | 'right';
		variant?: 'sidebar' | 'floating' | 'inset';
		collapsible?: 'offcanvas' | 'icon' | 'none';
	} = $props();

	const sidebar = useSidebar();
</script>

{#if collapsible === 'none'}
	<div
		class={cn(
			'flex h-full w-(--sidebar-width) shrink-0 flex-col bg-sidebar text-sidebar-foreground',
			className
		)}
		bind:this={ref}
		{...restProps}
	>
		{@render children?.()}
	</div>
{:else if sidebar.isMobile}
	<Sheet.Root open={sidebar.openMobile} onOpenChange={sidebar.setOpenMobile} {...restProps}>
		<Sheet.Content
			data-sidebar="sidebar"
			data-mobile="true"
			class="w-(--sidebar-width) max-w-none bg-sidebar p-0 text-sidebar-foreground shadow-none! [&>button]:hidden"
			style="--sidebar-width: {SIDEBAR_WIDTH_MOBILE};"
			{side}
		>
			<!-- Full-screen on phones: the panel colour runs under the system bars, the
			     content keeps clear. No overlay shadow: its inset rim would frame the screen. -->
			<div
				class="flex h-full w-full flex-col pt-(--safe-area-top) pr-(--safe-area-right) pb-(--safe-area-bottom) pl-(--safe-area-left)"
			>
				{@render children?.()}
			</div>
		</Sheet.Content>
	</Sheet.Root>
{:else}
	<div
		bind:this={ref}
		class="group peer hidden text-sidebar-foreground md:block"
		data-state={sidebar.state}
		data-collapsible={sidebar.state === 'collapsed' ? collapsible : ''}
		data-variant={variant}
		data-side={side}
		data-resizing={sidebar.isResizing || undefined}
	>
		<!-- The gap reflows the page, so it animates width; the panel only slides (transform).
		     Both share one curve to stay in step, and a drag resize skips the transition. -->
		<div
			class={cn(
				'relative h-svh w-(--sidebar-width) bg-transparent transition-[width] duration-(--duration-base) ease-(--ease-ui-out) group-data-resizing:transition-none motion-reduce:transition-none',
				'group-data-[collapsible=offcanvas]:w-0',
				'group-data-[side=right]:rotate-180',
				variant === 'floating' || variant === 'inset'
					? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--spacing)*4)]'
					: 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)'
			)}
		></div>
		<div
			class={cn(
				'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[translate,width] duration-(--duration-base) ease-(--ease-ui-out) will-change-[translate] group-data-resizing:transition-none motion-reduce:transition-none md:flex',
				side === 'left'
					? 'left-0 group-data-[collapsible=offcanvas]:-translate-x-full'
					: 'right-0 group-data-[collapsible=offcanvas]:translate-x-full',
				// Adjust the padding for floating and inset variants.
				variant === 'floating' || variant === 'inset'
					? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--spacing)*4+2px)]'
					: 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
				className
			)}
			{...restProps}
		>
			<div
				data-sidebar="sidebar"
				class="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow-sm"
			>
				{@render children?.()}
			</div>
		</div>
	</div>
{/if}
