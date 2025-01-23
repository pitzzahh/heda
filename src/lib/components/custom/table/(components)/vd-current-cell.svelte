<script lang="ts">
	import { Repeat } from 'lucide-svelte';
	import * as Tooltip from '@/components/ui/tooltip';
	import Button from '@/components/ui/button/button.svelte';
	import { useAtAsCurrentsValue } from '@/db/mutations';
	import type { VoltageDrop } from '@/types/voltage-drop';
	import { invalidate } from '$app/navigation';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';

	let { current, is_at_used, node }: { current: number; is_at_used: boolean; node: VoltageDrop } =
		$props();
	const undo_redo_state = getUndoRedoState();
	const project_state = getProjectState();

	async function handleChangeCurrentsValue() {
		const updated_data = (await useAtAsCurrentsValue(
			node.id,
			is_at_used ? false : true,
			project_state.current_project_name
		)) as unknown as VoltageDrop;
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			previous_data: node,
			data: updated_data
		});
		await invalidate('app:workspace/load-schedule');
	}
</script>

<div class="flex w-full items-center justify-center gap-2">
	{current}
	<Tooltip.Provider delayDuration={100}>
		<Tooltip.Root>
			<Tooltip.Trigger>
				<Button
					size="icon"
					onclick={handleChangeCurrentsValue}
					class="size-6"
					variant={is_at_used ? 'default' : 'outline'}
				>
					<Repeat class="size-3" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content class=" text-white">
				{is_at_used ? `Use the current's value itself` : 'Use the AT as the value of this current'}
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
