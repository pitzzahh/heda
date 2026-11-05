<script lang="ts" module>
	interface Props {
		tooltip_content: string;
		trigger_value: string;
	}
</script>

<script lang="ts">
	import { InfoIcon } from '#lib/assets/icons';
	import * as Tooltip from '#lib/components/ui/tooltip';

	let { trigger_value, tooltip_content }: Props = $props();
</script>

<div class="grid w-full place-content-center">
	<Tooltip.Provider delayDuration={100}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<p class="text-destructive flex items-center gap-[7px] text-center">
					{trigger_value}
					<InfoIcon class="size-[14px]" />
				</p>
			</Tooltip.Trigger>
			<Tooltip.Content class="bg-destructive text-destructive-foreground">
				{tooltip_content}
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
