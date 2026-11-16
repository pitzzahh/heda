<script lang="ts" module>
	import type { InterruptingRatingStatus } from '#lib/types/short-circuit.js';

	interface Props {
		status: InterruptingRatingStatus;
	}

	const STATUS_LABEL: Record<InterruptingRatingStatus, string> = {
		ok: 'OK',
		under_rated: 'UNDER-RATED',
		no_source: 'NO SOURCE'
	};

	const STATUS_HINT: Record<InterruptingRatingStatus, string> = {
		ok: 'The interrupting rating covers the available fault current (PEC 2017 1.10.1.9).',
		under_rated:
			'The available fault current exceeds this breaker’s interrupting rating (PEC 2017 1.10.1.9). Use a higher kAIC.',
		no_source: 'Enter the utility and transformer data above to compute fault currents.'
	};
</script>

<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';
	import { cn } from '#lib/utils/index.js';

	let { status }: Props = $props();
</script>

<div class="grid w-full place-content-center">
	<Tooltip.Root>
		<Tooltip.Trigger>
			<span
				class={cn('text-xs font-semibold tracking-wide', {
					'text-destructive': status === 'under_rated',
					'text-primary': status === 'ok',
					'text-muted-foreground': status === 'no_source'
				})}
			>
				{STATUS_LABEL[status]}
			</span>
		</Tooltip.Trigger>
		<Tooltip.Content>{STATUS_HINT[status]}</Tooltip.Content>
	</Tooltip.Root>
</div>
