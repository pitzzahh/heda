<script lang="ts">
	import {
		standard_ampere_ratings,
		AMPACITY_TO_CONDUCTOR_SIZE,
		AMPERE_TRIP_TO_COPPER,
		CONDUIT_TABLE
	} from '@/constants';
	import { ChevronUp, ChevronDown, X } from '@/assets/icons';
	import { Button } from '@/components/ui/button/index.js';
	import { overrideField, type FieldType } from '@/db/mutations';
	import { invalidate } from '$app/navigation';
	import * as Tooltip from '@/components/ui/tooltip';
	import { toast } from 'svelte-sonner';
	import * as Select from '$lib/components/ui/select/index.js';
	import Input from '@/components/ui/input/input.svelte';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';

	interface Props {
		node_id: string;
		closeDialog: () => void;
		current_at: number;
		current_ampere_frames: number;
		current_conductor_size: number;
		current_egc_size: number;
		current_conduit_size: number;
		current_length?: number;
		current_z?: number;
		overridden_fields: {
			egc_size: boolean;
			at: boolean;
			conductor_size: boolean;
			conduit_size: boolean;
			ampere_frames: boolean;
			length: boolean;
			z: boolean;
		};
		is_in_vd_table?: boolean;
	}
	let {
		node_id,
		closeDialog,
		current_at,
		current_conductor_size,
		current_egc_size,
		current_length,
		current_z,
		overridden_fields,
		current_conduit_size,
		current_ampere_frames,
		is_in_vd_table
	}: Props = $props();

	let undo_redo_state = getUndoRedoState();

	// AT
	const at_default_index = standard_ampere_ratings.findIndex((rating) => current_at === rating);
	let at_current_index = $state(at_default_index);
	const selected_ampere_rating = $derived(standard_ampere_ratings.at(at_current_index));
	const at_last_index = standard_ampere_ratings.length - 1;

	// Conductor Size
	const conductor_sizes = Object.values(AMPACITY_TO_CONDUCTOR_SIZE);
	const conductor_size_default_index = conductor_sizes.findIndex(
		(size) => current_conductor_size === size
	);
	let conductor_size_current_index = $state(conductor_size_default_index);
	const selected_conductor_size = $derived(conductor_sizes.at(conductor_size_current_index));
	const conductor_size_last_index = conductor_sizes.length - 1;

	// EGC Size
	const egc_sizes = Object.values(AMPERE_TRIP_TO_COPPER)
		.map((el) => el.size)
		.filter((el) => el !== 'error')
		.sort((a, b) => a - b);
	const egc_size_default_index = egc_sizes.findIndex((size) => current_egc_size === size);
	let egc_size_current_index = $state(egc_size_default_index);
	const selected_egc_size = $derived(egc_sizes.at(egc_size_current_index));
	const egc_size_last_index = egc_sizes.length - 1;

	// Conduit Size
	const conduit_sizes = CONDUIT_TABLE.conduit_columns;
	const conduit_size_default_index = conduit_sizes.findIndex(
		(size) => current_conduit_size === size
	);
	let conduit_size_current_index = $state(conduit_size_default_index);
	const selected_conduit_size = $derived(conduit_sizes.at(conduit_size_current_index));
	const conduit_size_last_index = conduit_sizes.length - 1;

	// Ampere Frames(AF)
	let ampere_frames = $state(current_ampere_frames.toString());
	const ampere_frames_ratings = ['50', '100', '125', '250', '400', '600', '800', '1000', '1200'];

	let length = $state(current_length || 0);
	let z = $state(current_z || 0);

	function handleIncrement(currentIndex: number, lastIndex: number): number {
		return currentIndex === lastIndex ? 0 : currentIndex + 1;
	}

	function handleDecrement(currentIndex: number, lastIndex: number): number {
		return currentIndex === 0 ? lastIndex : currentIndex - 1;
	}

	async function handleOverride() {
		const overridden_fields: string[] = [];

		if (selected_ampere_rating) {
			if (selected_ampere_rating !== current_at) {
				const updated_node = await overrideField({
					node_id,
					field_data: selected_ampere_rating,
					field_type: 'at'
				});
				overridden_fields.push('AT');
				undo_redo_state.setActionToUndo({
					data: updated_node as unknown as PhaseLoadSchedule,
					action: 'override_at'
				});
			}

			if (selected_conductor_size !== current_conductor_size) {
				const updated_node = await overrideField({
					node_id,
					field_data: selected_conductor_size,
					field_type: 'conductor_size'
				});
				overridden_fields.push('Conductor Size');
				undo_redo_state.setActionToUndo({
					data: updated_node as unknown as PhaseLoadSchedule,
					action: 'override_conductor_size'
				});
			}

			if (selected_egc_size !== current_egc_size) {
				const updated_node = await overrideField({
					node_id,
					field_data: selected_egc_size,
					field_type: 'egc_size'
				});
				overridden_fields.push('EGC Size');
				undo_redo_state.setActionToUndo({
					data: updated_node as unknown as PhaseLoadSchedule,
					action: 'override_egc_size'
				});
			}

			if (selected_conduit_size !== current_conduit_size) {
				const updated_node = await overrideField({
					node_id,
					field_data: selected_conduit_size,
					field_type: 'conduit_size'
				});
				overridden_fields.push('Conduit Size');
				undo_redo_state.setActionToUndo({
					data: updated_node as unknown as PhaseLoadSchedule,
					action: 'override_conduit_size'
				});
			}

			if (ampere_frames !== current_ampere_frames.toString()) {
				const updated_node = await overrideField({
					node_id,
					field_data: Number(ampere_frames),
					field_type: 'ampere_frames'
				});
				overridden_fields.push('Ampere Frames (AT)');
				undo_redo_state.setActionToUndo({
					data: updated_node as unknown as PhaseLoadSchedule,
					action: 'override_af'
				});
			}

			if (current_length && length !== current_length) {
				const updated_node = await overrideField({
					node_id,
					field_data: length,
					field_type: 'length'
				});
				overridden_fields.push('Length');
				undo_redo_state.setActionToUndo({
					data: updated_node as unknown as PhaseLoadSchedule,
					action: 'override_length'
				});
			}

			if (current_z && z !== current_z) {
				const updated_node = await overrideField({
					node_id,
					field_data: z,
					field_type: 'z'
				});
				overridden_fields.push('Z');
				undo_redo_state.setActionToUndo({
					data: updated_node as unknown as PhaseLoadSchedule,
					action: 'override_z'
				});
			}

			if (overridden_fields.length > 0) {
				toast.success(`Overridden: ${overridden_fields.join(', ')}.`);
			}

			invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
			closeDialog();
		}
	}
	async function removeOverride(field_type: FieldType) {
		const formatted_field = field_type
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');

		await overrideField({ node_id, field_type, unoverride: true });
		invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
		closeDialog();
		toast.success(`Removed override for ${formatted_field}`);
	}
</script>

<div class="flex w-full flex-col gap-4">
	{#if !is_in_vd_table}
		<!-- AT Selector -->
		<div class="grid gap-2">
			<p class="text-sm">AT</p>
			{@render Selector({
				selected_value: selected_ampere_rating,
				is_overridden: overridden_fields.at,
				handleDecrement: () =>
					(at_current_index = handleDecrement(at_current_index, at_last_index)),
				handleIncrement: () =>
					(at_current_index = handleIncrement(at_current_index, at_last_index)),
				handleRemoveOverride: () => removeOverride('at')
			})}
		</div>
	{/if}

	<!-- Conductor Size Selector -->
	<div class="grid gap-2">
		<p class="text-sm">{is_in_vd_table ? 'Cable' : 'Conductor'} Size</p>
		{@render Selector({
			selected_value: selected_conductor_size,
			is_overridden: overridden_fields.conductor_size,
			handleDecrement: () =>
				(conductor_size_current_index = handleDecrement(
					conductor_size_current_index,
					conductor_size_last_index
				)),
			handleIncrement: () =>
				(conductor_size_current_index = handleIncrement(
					conductor_size_current_index,
					conductor_size_last_index
				)),
			handleRemoveOverride: () => removeOverride('conductor_size')
		})}
	</div>

	{#if !is_in_vd_table}
		<!-- EGC Size Selector -->
		<div class="grid gap-2">
			<p class="text-sm">EGC Size</p>
			{@render Selector({
				selected_value: selected_egc_size,
				is_overridden: overridden_fields.egc_size,
				handleRemoveOverride: () => removeOverride('egc_size'),
				handleDecrement: () =>
					(egc_size_current_index = handleDecrement(egc_size_current_index, egc_size_last_index)),
				handleIncrement: () =>
					(egc_size_current_index = handleIncrement(egc_size_current_index, egc_size_last_index))
			})}
		</div>

		<!-- Conduit Size Selector -->
		<div class="grid gap-2">
			<p class="text-sm">Conduit Size</p>
			{@render Selector({
				selected_value: selected_conduit_size,
				is_overridden: overridden_fields.conduit_size,
				handleRemoveOverride: () => removeOverride('conduit_size'),
				handleDecrement: () =>
					(conduit_size_current_index = handleDecrement(
						conduit_size_current_index,
						conduit_size_last_index
					)),
				handleIncrement: () =>
					(conduit_size_current_index = handleIncrement(
						conduit_size_current_index,
						conduit_size_last_index
					))
			})}
		</div>

		<!-- Ampere Frames(AF) Selector -->
		<div class="flex flex-col gap-2">
			<p class="text-sm">Ampere Frames (AF)</p>
			<div class="flex items-center gap-2">
				<Input type="text" bind:value={ampere_frames} />
				<Select.Root type="single" bind:value={ampere_frames}>
					<Select.Trigger class="w-[40px] text-xs"></Select.Trigger>
					<Select.Content class="text-sm">
						{#each ampere_frames_ratings as ampere_frame, i (i)}
							<Select.Item value={ampere_frame} disabled={ampere_frames === ampere_frame}>
								{ampere_frame}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				{#if overridden_fields.ampere_frames}
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									class="h-8 w-full max-w-8"
									size="sm"
									variant="destructive"
									onclick={() => removeOverride('ampere_frames')}
								>
									<X class="size-4" />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content class="bg-red-500 text-white">Remove Override</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Length Field -->
	{#if is_in_vd_table}
		<div class="flex flex-col gap-2">
			<p class="text-sm">Length</p>
			<div class="flex items-center gap-2">
				<Input type="number" bind:value={length} />
				{#if overridden_fields.length}
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									class="h-8 w-full max-w-8"
									size="sm"
									variant="destructive"
									onclick={() => removeOverride('length')}
								>
									<X class="size-4" />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content class="bg-red-500 text-white">Remove Override</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<p class="text-sm">Z (Ω/305m)</p>
			<div class="flex items-center gap-2">
				<Input type="number" bind:value={z} />
				{#if overridden_fields.z}
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								<Button
									class="h-8 w-full max-w-8"
									size="sm"
									variant="destructive"
									onclick={() => removeOverride('z')}
								>
									<X class="size-4" />
								</Button>
							</Tooltip.Trigger>
							<Tooltip.Content class="bg-red-500 text-white">Remove Override</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{/if}
			</div>
		</div>
	{/if}

	<Button class="w-full" onclick={handleOverride}>Override</Button>
</div>

{#snippet Selector({
	selected_value,
	handleDecrement,
	handleIncrement,
	is_overridden,
	handleRemoveOverride
}: {
	selected_value?: number;
	handleDecrement: () => void;
	handleIncrement: () => void;
	handleRemoveOverride: () => void;
	is_overridden: boolean;
})}
	<div class="flex items-center gap-2">
		<div class="flex w-full items-center justify-center gap-2">
			<Button class="h-8 w-full max-w-8" size="icon" onclick={handleDecrement}>
				<ChevronDown class="size-4" />
			</Button>
			<p class="w-full min-w-12 border py-1 text-center">{selected_value}</p>
			<Button class="h-8 w-full max-w-8" size="sm" onclick={handleIncrement}>
				<ChevronUp class="size-4" />
			</Button>
		</div>
		{#if is_overridden}
			<Tooltip.Provider delayDuration={100}>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<Button
							class="h-8 w-full max-w-8"
							size="sm"
							variant="destructive"
							onclick={handleRemoveOverride}
						>
							<X class="size-4" />
						</Button>
					</Tooltip.Trigger>
					<Tooltip.Content class="bg-red-500 text-white">Remove Override</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
	</div>
{/snippet}
