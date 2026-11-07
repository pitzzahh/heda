<script lang="ts" module>
	import { RepeatIcon } from '#lib/assets/icons';
	import type { VoltageDrop } from '#lib/types/voltage-drop';

	interface Props {
		current: number;
		is_at_used: boolean;
		node: VoltageDrop;
	}
</script>

<script lang="ts">
	import * as Tooltip from '#lib/components/ui/tooltip';
	import Button from '#lib/components/ui/button/button.svelte';
	import { useAtAsCurrentsValue } from '#lib/db/mutations';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';

	let { current, is_at_used, node }: Props = $props();
	let undo_redo_state = getUndoRedoState();
	const db_revisions = getDbRevisionsState();

	async function handleChangeCurrentsValue() {
		const updated_data = (await useAtAsCurrentsValue(
			node.id,
			is_at_used ? false : true
		)) as unknown as VoltageDrop;
		undo_redo_state.setActionToUndo({
			action: 'update_node',
			previous_data: node,
			data: updated_data
		});
		db_revisions.bumpSchedule();
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
					<RepeatIcon class="size-3" />
				</Button>
			</Tooltip.Trigger>
			<Tooltip.Content>
				{is_at_used ? `Use the current's value itself` : 'Use the AT as the value of this current'}
			</Tooltip.Content>
		</Tooltip.Root>
	</Tooltip.Provider>
</div>
