<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { buttonVariants } from '@/components/ui/button';
	import { Redo, Undo } from 'lucide-svelte';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { cn } from '@/utils';

	let undo_redo_state = getUndoRedoState();
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger
			class={buttonVariants({
				variant: 'outline',
				size: 'icon',
				className: cn({
					'cursor-not-allowed': !undo_redo_state.hasUndoActions()
				})
			})}
			onclick={() => undo_redo_state.undo()}
			disabled={!undo_redo_state.hasUndoActions()}
		>
			<Undo class="h-4 w-4" />
		</Tooltip.Trigger>
		<Tooltip.Content>Undo</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger
			class={buttonVariants({
				variant: 'outline',
				size: 'icon',
				className: cn({
					'cursor-not-allowed': !undo_redo_state.hasRedoActions()
				})
			})}
			onclick={() => undo_redo_state.redo()}
			disabled={!undo_redo_state.hasRedoActions()}
		>
			<Redo class="h-4 w-4" />
		</Tooltip.Trigger>
		<Tooltip.Content>Redo</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
