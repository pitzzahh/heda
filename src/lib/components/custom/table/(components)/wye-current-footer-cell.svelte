<script lang="ts" module>
	interface Props {
		current: number;
		balanced_current: number | undefined;
	}
</script>

<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let { current, balanced_current }: Props = $props();
</script>

<div class="grid w-full place-content-center">
	<Tooltip.Root>
		<Tooltip.Trigger class="underline decoration-dotted underline-offset-4">
			{current.toFixed(2)}
		</Tooltip.Trigger>
		<Tooltip.Content>
			Sized on the larger of the balanced current, VA ÷ (400 V × 1.732) = {(
				balanced_current ?? 0
			).toFixed(2)} A (PEC 2017 App. D Ex. D6), and the most loaded phase at 230 V.
		</Tooltip.Content>
	</Tooltip.Root>
</div>
