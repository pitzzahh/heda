<script lang="ts" module>
	import type { SheetSide } from './variants';

	interface Props {
		open?: boolean;
		side?: SheetSide;
	}
</script>

<script lang="ts">
	import * as Sheet from './index.js';

	let { open = $bindable(false), side = 'right' }: Props = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Trigger>Open sheet</Sheet.Trigger>
	<Sheet.Content {side}>
		<Sheet.Title>Fixture sheet</Sheet.Title>
		<p>Sheet body</p>
	</Sheet.Content>
</Sheet.Root>
