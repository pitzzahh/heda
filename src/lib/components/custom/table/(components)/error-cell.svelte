<script lang="ts" module>
	interface Props {
		tooltip_content: string;
		trigger_value: string;
	}
</script>

<script lang="ts">
	import { InfoIcon } from '#lib/assets/icons/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let { trigger_value, tooltip_content }: Props = $props();
</script>

<div class="grid w-full place-content-center">
	<Tooltip.Root>
		<Tooltip.Trigger>
			<p class="text-destructive flex items-center gap-1.75 text-center">
				{trigger_value}
				<InfoIcon class="size-3.5" />
			</p>
		</Tooltip.Trigger>
		<Tooltip.Content class="bg-destructive text-destructive-foreground">
			{tooltip_content}
		</Tooltip.Content>
	</Tooltip.Root>
</div>
