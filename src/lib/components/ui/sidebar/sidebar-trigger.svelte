<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { cn } from '@/utils';
	import PanelLeft from 'lucide-svelte/icons/panel-left';
	import type { ComponentProps } from 'svelte';
	import { useSidebar } from './context.svelte.js';
	import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
			<PanelLeft />
			<span class="sr-only">Toggle Sidebar</span>
		</Button>
	</TooltipTrigger>
	<TooltipContent>{sidebar.open ? 'Close Sidebar' : 'Open Sidebar'}</TooltipContent>
</Tooltip>
