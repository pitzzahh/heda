<script lang="ts">
	import { SidebarIcon } from '#lib/assets/icons/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { cn } from '#lib/utils/index.js';
	import type { ComponentProps } from 'svelte';
	import { useSidebar } from './context.svelte.js';
	import { Tooltip, TooltipContent, TooltipTrigger } from '#lib/components/ui/tooltip/index.js';

	let {
		ref = $bindable(null),
		class: className,
		onclick,
		...restProps
	}: ComponentProps<typeof Button> & {
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const sidebar = useSidebar();
</script>

<Tooltip>
	<TooltipTrigger>
		<Button
			type="button"
			onclick={(e) => {
				onclick?.(e);
				sidebar.toggle();
			}}
			data-sidebar="trigger"
			variant="ghost"
			size="icon"
			class={cn('h-7 w-7', className)}
			{...restProps}
		>
			<SidebarIcon />
			<span class="sr-only">Toggle Sidebar</span>
		</Button>
	</TooltipTrigger>
	<TooltipContent>{sidebar.open ? 'Close Sidebar' : 'Open Sidebar'}</TooltipContent>
</Tooltip>
