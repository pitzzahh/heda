<script lang="ts">
	import { InfoIcon } from 'lucide-svelte';
	import { cn } from '@/utils';
	import * as Tooltip from '@/components/ui/tooltip';

	let { at, has_greater_child_at }: { at: string; has_greater_child_at: boolean } = $props();
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			<p class={cn('flex items-center gap-[7px]', has_greater_child_at && 'text-red-500')}>
				{at}
				<InfoIcon
					class={cn('size-[14px]', {
						hidden: !has_greater_child_at
					})}
				/>
			</p>
		</Tooltip.Trigger>
		{#if has_greater_child_at}
			<Tooltip.Content class="bg-red-500 text-white">
				The AT of this unit should be greater than its loads
			</Tooltip.Content>
		{/if}
	</Tooltip.Root>
</Tooltip.Provider>
