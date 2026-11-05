<script lang="ts" module>
	interface Props {
		at: string;
		has_greater_child_at: boolean;
	}
</script>

<script lang="ts">
	import { InfoIcon } from '#lib/assets/icons';
	import { cn } from '#lib/utils';
	import * as Tooltip from '#lib/components/ui/tooltip';

	let { at, has_greater_child_at }: Props = $props();
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			<p class={cn('flex items-center gap-[7px]', has_greater_child_at && 'text-destructive')}>
				{at}
				<InfoIcon
					class={cn('size-[14px]', {
						hidden: !has_greater_child_at
					})}
				/>
			</p>
		</Tooltip.Trigger>
		{#if has_greater_child_at}
			<Tooltip.Content class="bg-destructive text-destructive-foreground">
				The AT of this unit should be greater than its loads
			</Tooltip.Content>
		{/if}
	</Tooltip.Root>
</Tooltip.Provider>
