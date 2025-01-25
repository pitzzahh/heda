<script lang="ts">
	import * as Tooltip from '@/components/ui/tooltip';
	import { buttonVariants } from '@/components/ui/button';
	import { Redo, Undo, Loader } from '@/assets/icons';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { cn } from '@/utils';
	const undo_redo_state = getUndoRedoState();
	let component_state = $state({
		undo_status: 'idle' as 'idle' | 'processing',
		redo_status: 'idle' as 'idle' | 'processing'
	});
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger
			class={buttonVariants({ variant: 'outline', size: 'icon' })}
			onclick={() => {
				component_state.undo_status = 'processing';
				undo_redo_state.undo().finally(() => (component_state.undo_status = 'idle'));
			}}
			disabled={!undo_redo_state.hasUndoActions()}
		>
			<Loader
				class={cn('hidden h-4 w-4 animate-spin', {
					block: component_state.undo_status === 'processing'
				})}
			/>
			<Undo
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
			class={buttonVariants({ variant: 'outline', size: 'icon' })}
			onclick={() => {
				component_state.redo_status = 'processing';
				undo_redo_state.redo().finally(() => (component_state.redo_status = 'idle'));
			}}
			disabled={!undo_redo_state.hasRedoActions()}
		>
			<Loader
				class={cn('hidden h-4 w-4 animate-spin', {
					block: component_state.redo_status === 'processing'
				})}
			/>
			<Redo
				class={cn('block h-4 w-4', {
					hidden: component_state.redo_status === 'processing'
				})}
			/>
		</Tooltip.Trigger>
		<Tooltip.Content>Redo</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
