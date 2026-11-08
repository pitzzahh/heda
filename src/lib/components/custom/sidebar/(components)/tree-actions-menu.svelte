<script lang="ts" module>
	import type {
		CopyIcon,
		FileArrowUpIcon,
		PencilIcon,
		PlusCircleIcon,
		SquaresFourIcon,
		TrashIcon
	} from '#lib/assets/icons/index.js';

	type TooltipIcon =
		| typeof CopyIcon
		| typeof PencilIcon
		| typeof TrashIcon
		| typeof SquaresFourIcon
		| typeof PlusCircleIcon
		| typeof FileArrowUpIcon;

	export interface TooltipAction {
		trigger_callback: () => unknown;
		variant: string;
		icon: TooltipIcon;
		hidden?: boolean;
		className: string;
		tooltip_content: string;
	}

	interface Props {
		actions: TooltipAction[];
	}
</script>

<script lang="ts">
	import { DotsThreeIcon } from '#lib/assets/icons/index.js';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { useSidebar } from '#lib/components/ui/sidebar/context.svelte.js';
	import { Portal } from 'bits-ui';
	import { cn } from '#lib/utils/index.js';

	let { actions }: Props = $props();

	const sidebar_context = useSidebar();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class="mr-2">
		{#snippet child({ props })}
			<Sidebar.MenuAction {...props}>
				<DotsThreeIcon />
				<span class="sr-only">Actions</span>
			</Sidebar.MenuAction>
		{/snippet}
	</DropdownMenu.Trigger>
	<Portal>
		<DropdownMenu.Content
			class="grid rounded-lg"
			side={sidebar_context.isMobile ? 'bottom' : 'right'}
			align={sidebar_context.isMobile ? 'end' : 'start'}
		>
			<DropdownMenu.Group>
				{#each actions as { trigger_callback, icon, hidden, tooltip_content, className }, i (tooltip_content)}
					{#if !hidden}
						<DropdownMenu.Item onclick={() => trigger_callback()} class={cn('z-auto', className)}>
							{@const Icon = icon}
							<Icon class={i === actions.length - 1 ? 'text-inherit' : undefined} />
							<span class="text-sm">{tooltip_content}</span>
						</DropdownMenu.Item>
					{/if}
				{/each}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</Portal>
</DropdownMenu.Root>
