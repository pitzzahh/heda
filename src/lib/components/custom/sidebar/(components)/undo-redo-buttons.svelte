<script lang="ts">
	import { ArrowUUpLeftIcon, ArrowUUpRightIcon, CircleNotchIcon } from '#lib/assets/icons';
	import * as Tooltip from '#lib/components/ui/tooltip';
	import { buttonVariants } from '#lib/components/ui/button';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { cn } from '#lib/utils';
	const undo_redo_state = getUndoRedoState();
	let component_state = $state({
		undo_status: 'idle' as 'idle' | 'processing',
		redo_status: 'idle' as 'idle' | 'processing'
	});
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger
			class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
			onclick={() => {
				component_state.undo_status = 'processing';
				undo_redo_state.undo().finally(() => (component_state.undo_status = 'idle'));
			}}
			disabled={!undo_redo_state.hasUndoActions()}
		>
			<CircleNotchIcon
				class={cn('hidden h-4 w-4 animate-spin', {
					block: component_state.undo_status === 'processing'
				})}
			/>
			<ArrowUUpLeftIcon
				class={cn('block h-4 w-4', {
					hidden: component_state.undo_status === 'processing'
				})}
			/>
		</Tooltip.Trigger>
		<Tooltip.Content>Undo</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger
			class={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
			onclick={() => {
				component_state.redo_status = 'processing';
				undo_redo_state.redo().finally(() => (component_state.redo_status = 'idle'));
			}}
			disabled={!undo_redo_state.hasRedoActions()}
		>
			<CircleNotchIcon
				class={cn('hidden h-4 w-4 animate-spin', {
					block: component_state.redo_status === 'processing'
				})}
			/>
			<ArrowUUpRightIcon
				class={cn('block h-4 w-4', {
					hidden: component_state.redo_status === 'processing'
				})}
			/>
		</Tooltip.Trigger>
		<Tooltip.Content>Redo</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
