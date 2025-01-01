<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { buttonVariants } from '@/components/ui/button';
	import { Redo, Undo } from 'lucide-svelte';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';

	let undo_redo_state = getUndoRedoState();
</script>

<div class="flex items-center gap-2">
	<Tooltip.Provider delayDuration={100}>
		<Tooltip.Root>
			<Tooltip.Trigger
				class={buttonVariants({ variant: 'outline', size: 'icon' })}
				onclick={() => undo_redo_state.undo()}
			>
				<Undo class="h-4 w-4" />
			</Tooltip.Trigger>
			<Tooltip.Content>Undo</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>

	<Tooltip.Provider delayDuration={100}>
		<Tooltip.Root>
			<Tooltip.Trigger
				class={buttonVariants({ variant: 'outline', size: 'icon' })}
				onclick={() => undo_redo_state.redo()}
			>
				<Redo class="h-4 w-4" />
			</Tooltip.Trigger>
			<Tooltip.Content>Redo</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
