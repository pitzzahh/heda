<script lang="ts" module>
	import type { LineCurrent } from '#lib/types/phase.js';

	interface Props {
		current: number;
		balanced_current: number | undefined;
		/** Delta panels: the current in each line. */
		line_current?: LineCurrent;
		/** 400 V on a 400Y/230 V panel, 230 V on a delta one. */
		line_voltage: number;
	}
</script>

<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let { current, balanced_current, line_current, line_voltage }: Props = $props();
</script>

<div class="grid w-full place-content-center">
	<Tooltip.Root>
		<Tooltip.Trigger class="underline decoration-dotted underline-offset-4">
			{current.toFixed(2)}
		</Tooltip.Trigger>
		<Tooltip.Content>
			Sized on the larger of the balanced current, VA ÷ ({line_voltage} V × 1.732) = {(
				balanced_current ?? 0
			).toFixed(2)} A (PEC 2017 App. D Ex. D6), and
			{#if line_current}
				the most loaded line: A {line_current.A.toFixed(2)} A, B {line_current.B.toFixed(2)} A, C
				{line_current.C.toFixed(2)} A.
			{:else}
				the most loaded phase at 230 V.
			{/if}
		</Tooltip.Content>
	</Tooltip.Root>
</div>
