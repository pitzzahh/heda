<script lang="ts" module>
	interface Props {
		on_remove: () => void;
	}
</script>

<script lang="ts">
	import { XIcon } from '#lib/assets/icons/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Tooltip from '#lib/components/ui/tooltip/index.js';

	let { on_remove }: Props = $props();
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger onclick={() => on_remove()}>
			<Tooltip.Content
				class="border-destructive/20 bg-destructive px-2 py-0.5 text-[11px] font-semibold text-white shadow-lg"
			>
				Remove Override
			</Tooltip.Content>
			<Button variant="destructive" size="icon" class="size-6">
				<XIcon class="size-3" />
			</Button>
		</Tooltip.Trigger>
	</Tooltip.Root>
</Tooltip.Provider>
