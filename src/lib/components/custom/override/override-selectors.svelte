<script lang="ts" module>
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

	const ampere_frames_ratings = ['50', '100', '125', '250', '400', '600', '800', '1000', '1200'];

	/** The entry at `index`; none when the current value is in no list (-1, "none in the PEC table"). */
	export function valueAt<T>(list: readonly T[], index: number): T | undefined {
		return index < 0 ? undefined : list[index];
	}

	/** One step up, wrapping; from none to the first entry. */
	export function stepUp(index: number, last_index: number): number {
		return index >= last_index ? 0 : index + 1;
	}

	/** One step down, wrapping; from none (or the first entry) to the last. */
	export function stepDown(index: number, last_index: number): number {
		return index <= 0 ? last_index : index - 1;
	}

	/** Whether the picker holds a value the user chose that differs from the current one. */
	export function isPicked<T>(selected: T | undefined, current: T): selected is T {
		return selected !== undefined && selected !== current;
	}
</script>

<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { RemoveOverrideButton, StepperField } from './(components)/index.js';
	import { overrideField, type FieldType } from '#lib/db/mutations/index.js';
	import { toast } from 'svelte-sonner';
	import * as Select from '#lib/components/ui/select/index.js';
	import Input from '#lib/components/ui/input/input.svelte';
	import { getCatalog } from '#lib/core/catalog.js';
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

	// The PEC 2017 steps each override walks (Tables 2.40.1.6(A), 3.10.2.6(B)(16), 2.50.6.13, 10.1.1.4).
	const {
		breaker_ratings: standard_ampere_ratings,
		conductor_sizes,
		egc_sizes,
		conduit_sizes
	} = getCatalog();
	const at_last_index = standard_ampere_ratings.length - 1;
	const conductor_size_last_index = conductor_sizes.length - 1;
	const egc_size_last_index = egc_sizes.length - 1;
	const conduit_size_last_index = conduit_sizes.length - 1;

	// AT
	const at_default_index = standard_ampere_ratings.findIndex((rating) => current_at === rating);
	let at_current_index = $state(at_default_index);
	const selected_ampere_rating = $derived(valueAt(standard_ampere_ratings, at_current_index));

	// Conductor Size
	const conductor_size_default_index = conductor_sizes.findIndex(
		(size) => current_conductor_size === size
	);
	let conductor_size_current_index = $state(conductor_size_default_index);
	const selected_conductor_size = $derived(valueAt(conductor_sizes, conductor_size_current_index));

	// EGC Size
	const egc_size_default_index = egc_sizes.findIndex((size) => current_egc_size === size);
	let egc_size_current_index = $state(egc_size_default_index);
	const selected_egc_size = $derived(valueAt(egc_sizes, egc_size_current_index));

	// Conduit Size
	const conduit_size_default_index = conduit_sizes.findIndex(
		(size) => current_conduit_size === size
	);
	let conduit_size_current_index = $state(conduit_size_default_index);
	const selected_conduit_size = $derived(valueAt(conduit_sizes, conduit_size_current_index));

	// Ampere Frames(AF)
	// Snapshot at mount: local edit state, never tracks later prop changes.
	const initial_override_inputs = (() => ({
		ampere_frames: current_ampere_frames.toString(),
		length: current_length || 0,
		z: current_z || 0
	}))();
	let ampere_frames = $state(initial_override_inputs.ampere_frames);

	let length = $state(initial_override_inputs.length);
	let z = $state(initial_override_inputs.z);
	// Same conditions handleOverride writes on, so Override is off exactly when it would do nothing.
	const has_changes = $derived(
		isPicked(selected_ampere_rating, current_at) ||
			isPicked(selected_conductor_size, current_conductor_size) ||
			isPicked(selected_egc_size, current_egc_size) ||
			isPicked(selected_conduit_size, current_conduit_size) ||
			ampere_frames !== current_ampere_frames.toString() ||
			(!!current_length && length !== current_length) ||
			(!!current_z && z !== current_z)
	);

	async function handleOverride() {
		const overridden_fields: string[] = [];

		if (isPicked(selected_ampere_rating, current_at)) {
			await overrideField({
				node_id,
				field_data: selected_ampere_rating,
				field_type: 'at'
			});
			overridden_fields.push('AT');
		}

		if (isPicked(selected_conductor_size, current_conductor_size)) {
			await overrideField({
				node_id,
				field_data: selected_conductor_size,
				field_type: 'conductor_size'
			});
			overridden_fields.push('Conductor Size');
		}

		if (isPicked(selected_egc_size, current_egc_size)) {
			await overrideField({
				node_id,
				field_data: selected_egc_size,
				field_type: 'egc_size'
			});
			overridden_fields.push('EGC Size');
		}

		if (isPicked(selected_conduit_size, current_conduit_size)) {
			await overrideField({
				node_id,
				field_data: selected_conduit_size,
				field_type: 'conduit_size'
			});
			overridden_fields.push('Conduit Size');
		}

		if (ampere_frames !== current_ampere_frames.toString()) {
			await overrideField({
				node_id,
				field_data: Number(ampere_frames),
				field_type: 'ampere_frames'
			});
			overridden_fields.push('Ampere Frames (AT)');
		}

		if (current_length && length !== current_length) {
			await overrideField({
				node_id,
				field_data: length,
				field_type: 'length'
			});
			overridden_fields.push('Length');
		}

		if (current_z && z !== current_z) {
			await overrideField({
				node_id,
				field_data: z,
				field_type: 'z'
			});
			overridden_fields.push('Z');
		}

		if (overridden_fields.length > 0) {
			toast.success(`Overridden: ${overridden_fields.join(', ')}.`);
		}

		closeDialog();
	}
	async function removeOverride(field_type: FieldType) {
		const formatted_field = field_type
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');

		await overrideField({ node_id, field_type, unoverride: true });
		closeDialog();
		toast.success(`Removed override for ${formatted_field}`);
	}
</script>

<div class="flex w-full flex-col gap-4">
	{#if !is_in_vd_table}
		<!-- AT Selector -->
		<div class="grid gap-2">
			<p class="text-sm">AT</p>
			<StepperField
				selected_value={selected_ampere_rating}
				is_overridden={overridden_fields.at}
				on_decrement={() => (at_current_index = stepDown(at_current_index, at_last_index))}
				on_increment={() => (at_current_index = stepUp(at_current_index, at_last_index))}
				on_remove_override={() => removeOverride('at')}
			/>
		</div>
	{/if}

	<!-- Conductor Size Selector -->
	<div class="grid gap-2">
		<p class="text-sm">
			{#if is_in_vd_table}Cable{:else}Conductor{/if} Size
		</p>
		<StepperField
			selected_value={selected_conductor_size}
			is_overridden={overridden_fields.conductor_size}
			on_decrement={() =>
				(conductor_size_current_index = stepDown(
					conductor_size_current_index,
					conductor_size_last_index
				))}
			on_increment={() =>
				(conductor_size_current_index = stepUp(
					conductor_size_current_index,
					conductor_size_last_index
				))}
			on_remove_override={() => removeOverride('conductor_size')}
		/>
	</div>

	{#if !is_in_vd_table}
		<!-- EGC Size Selector -->
		<div class="grid gap-2">
			<p class="text-sm">EGC Size</p>
			<StepperField
				selected_value={selected_egc_size}
				is_overridden={overridden_fields.egc_size}
				on_decrement={() =>
					(egc_size_current_index = stepDown(egc_size_current_index, egc_size_last_index))}
				on_increment={() =>
					(egc_size_current_index = stepUp(egc_size_current_index, egc_size_last_index))}
				on_remove_override={() => removeOverride('egc_size')}
			/>
		</div>

		<!-- Conduit Size Selector -->
		<div class="grid gap-2">
			<p class="text-sm">Conduit Size</p>
			<StepperField
				selected_value={selected_conduit_size}
				is_overridden={overridden_fields.conduit_size}
				on_decrement={() =>
					(conduit_size_current_index = stepDown(
						conduit_size_current_index,
						conduit_size_last_index
					))}
				on_increment={() =>
					(conduit_size_current_index = stepUp(
						conduit_size_current_index,
						conduit_size_last_index
					))}
				on_remove_override={() => removeOverride('conduit_size')}
			/>
		</div>

		<!-- Ampere Frames(AF) Selector -->
		<div class="flex flex-col gap-2">
			<p class="text-sm">Ampere Frames (AF)</p>
			<div class="flex items-center gap-2">
				<Input type="text" bind:value={ampere_frames} />
				<Select.Root type="single" bind:value={ampere_frames}>
					<Select.Trigger class="w-20 shrink-0 text-xs">{ampere_frames}</Select.Trigger>
					<Select.Content class="text-sm">
						{#each ampere_frames_ratings as ampere_frame, i (i)}
							<Select.Item value={ampere_frame} disabled={ampere_frames === ampere_frame}>
								{ampere_frame}
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>

				{#if overridden_fields.ampere_frames}
					<RemoveOverrideButton on_remove={() => removeOverride('ampere_frames')} />
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
					<RemoveOverrideButton on_remove={() => removeOverride('length')} />
				{/if}
			</div>
		</div>

		<div class="flex flex-col gap-2">
			<p class="text-sm">Z (Ω/305m)</p>
			<div class="flex items-center gap-2">
				<Input type="number" bind:value={z} />
				{#if overridden_fields.z}
					<RemoveOverrideButton on_remove={() => removeOverride('z')} />
				{/if}
			</div>
		</div>
	{/if}
</div>

<Dialog.Footer>
	<Button type="button" variant="ghost" onclick={closeDialog}>Cancel</Button>
	<Button disabled={!has_changes} onclick={handleOverride}>Override</Button>
</Dialog.Footer>
