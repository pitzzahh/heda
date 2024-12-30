<script lang="ts">
	import { InfoIcon } from 'lucide-svelte';
	import * as Tooltip from '@/components/ui/tooltip';

	let { trigger_value, tooltip_content }: { tooltip_content: string; trigger_value: string } =
		$props();
</script>

<div class="grid w-full place-content-center">
	<Tooltip.Provider delayDuration={100}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<p class="flex items-center gap-[7px] text-center text-red-500">
					{trigger_value}
					<InfoIcon class="size-[14px]" />
				</p>
			</Tooltip.Trigger>
			<Tooltip.Content class="bg-red-500 text-white">
				{tooltip_content}
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
