<script lang="ts" module>
	import {
		ArrowsCounterClockwiseIcon,
		CopyIcon,
		DotsThreeIcon,
		PencilIcon,
		TrashIcon
	} from '#lib/assets/icons/index.js';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
	import type { VoltageDrop } from '#lib/types/voltage-drop/index.js';

	interface Props {
		node: VoltageDrop | PhaseLoadSchedule;
		is_in_vd_table?: boolean;
	}
</script>

<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import { getSettingsState } from '#lib/hooks/settings-state.svelte.js';
	import { getTableActions } from '../table-actions.svelte.js';

	let { node, is_in_vd_table }: Props = $props();

	const table_actions = getTableActions();
	const undo_redo_state = getUndoRedoState();
	const settings_state = getSettingsState();

	let open_dropdown_menu = $state(false);

	function handleCopy() {
		if (settings_state.is_load_multi_copy) {
			table_actions.open_copy(node);
			return;
		}
		undo_redo_state.copyNodeById(node.id);
	}
</script>

<div class="grid w-full place-content-center">
	<DropdownMenu.Root bind:open={open_dropdown_menu}>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button size="icon" variant="outline" {...props}>
					<DotsThreeIcon class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Group>
				<DropdownMenu.Label>Actions</DropdownMenu.Label>
				<DropdownMenu.Separator />

				{#if node.node_type === 'load' && !is_in_vd_table}
					<DropdownMenu.Item onclick={() => table_actions.open_update(node)}>
						<PencilIcon class="ml-2 size-4" />
						Update
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={handleCopy}>
						<CopyIcon class="ml-2 size-4" />
						Copy
					</DropdownMenu.Item>
				{/if}

				<DropdownMenu.Item onclick={() => table_actions.open_override(node)}>
					<ArrowsCounterClockwiseIcon class="ml-2 size-4" />
					Override
				</DropdownMenu.Item>

				{#if node.node_type === 'load' && !is_in_vd_table}
					<DropdownMenu.Item
						class="text-destructive hover:bg-destructive/10!"
						onclick={() => table_actions.open_confirm(node, () => (open_dropdown_menu = false))}
					>
						<TrashIcon class="ml-2 size-4" />
						Delete
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>
