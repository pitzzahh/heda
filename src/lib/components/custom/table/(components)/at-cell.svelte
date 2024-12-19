<script lang="ts">
	import { InfoIcon } from 'lucide-svelte';
	import { cn } from '@/utils';
	import * as Tooltip from '@/components/ui/tooltip';

	let { at, is_greater_than_parent }: { at: string; is_greater_than_parent: boolean } = $props();
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			<p class={cn('flex items-center gap-[7px]', is_greater_than_parent && 'text-red-500')}>
				{at}
				<InfoIcon
					class={cn('size-[14px]', {
						hidden: !is_greater_than_parent
					})}
				/>
			</p>
		</Tooltip.Trigger>
		<Tooltip.Content class="bg-red-500 text-white"
			>The AT of this load is greater or equal than main</Tooltip.Content
		>
	</Tooltip.Root>
</Tooltip.Provider>
