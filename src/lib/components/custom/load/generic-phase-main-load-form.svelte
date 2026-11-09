<script lang="ts" module>
	interface Props {
		closeDialog: () => void;
		selected_parent_id?: string;
		node_to_edit?: Node;
		action: 'add' | 'edit';
		latest_circuit_node?: Node;
		panel_id_from_tree?: string;
	}

	export type FormLoadTypeOption = 'DEFAULT' | 'CUSTOM';
</script>

<script lang="ts">
	import { WarningCircleIcon } from '#lib/assets/icons/index.js';
	import { scale } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { createForm, Field, getInput, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { cn } from '#lib/utils/index.js';
	import {
		default_load_types,
		load_type_to_varies_label,
		default_hp_current_relationship,
		load_type_to_quantity_label
	} from '#lib/constants/index.js';
	import {
		AmbientTempField,
		NumberField,
		TerminalTempField
	} from '#lib/components/custom/fields/index.js';
	import { LoadDescriptionField, LoadTypeField, VariesField } from './(components)/index.js';
	import { GENERIC_PHASE_MAIN_LOAD_SCHEMA } from '#lib/validators/load/index.js';
	import type { GenericPhaseMainLoadSchema } from '#lib/types/load/index.js';
	import { page } from '$app/state';
	import { addNode, updateNode } from '#lib/db/mutations/index.js';
	import { checkNodeExists } from '#lib/db/queries/index.js';
	import { convertToNormalText } from '#lib/utils/format/index.js';
	import type { Node } from '#lib/types/db/index.js';
	import type {
		LoadType,
		QuantityLabel,
		TerminalTemperature,
		VariesLabel
	} from '#lib/types/load/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';

	let {
		closeDialog,
		node_to_edit,
		action,
		selected_parent_id,
		latest_circuit_node,
		panel_id_from_tree
	}: Props = $props();

	let undo_redo_state = getUndoRedoState();
	let collapsibles = getCollapsiblesState();

	function buildInitialInput() {
		if (action !== 'edit')
			return { circuit_number: (latest_circuit_node?.circuit_number ?? 0) + 1 };
		if (!node_to_edit || !node_to_edit.load_data) {
			// TODO: Log system error
			toast.warning('Failed to identify the load to edit', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return {};
		}
		return {
			circuit_number: node_to_edit.circuit_number,
			load_description: node_to_edit.load_data.load_description.split(' - ')[1],
			terminal_temperature: node_to_edit.load_data.terminal_temperature as TerminalTemperature,
			load_type: node_to_edit.load_data.load_type as LoadType,
			quantity: node_to_edit.load_data.quantity,
			varies: node_to_edit.load_data.varies,
			continuous: node_to_edit.load_data.continuous,
			length: node_to_edit.length
		};
	}

	const form = createForm({
		schema: GENERIC_PHASE_MAIN_LOAD_SCHEMA,
		initialInput: buildInitialInput()
	});

	let taken_circuit_number = $state(0);
	let submitting = $state(false);
	const is_circuit_number_taken = $derived(
		taken_circuit_number !== 0 &&
			getInput(form, { path: ['circuit_number'] }) === taken_circuit_number
	);

	async function handleSubmit() {
		if (submitting) return;
		const result = await validate(form);
		if (!result.success) {
			toast.error('Form is invalid');
			return;
		}
		const data = result.output;
		submitting = true;

		if (panel_id_from_params || panel_id_from_tree) {
			taken_circuit_number = checkNodeExists({
				circuit_number: data.circuit_number,
				parent_id: selected_parent_id || panel_id_from_tree || panel_id_from_params || '',
				node_id: node_to_edit?.id
			})
				? data.circuit_number
				: 0;

			if (is_circuit_number_taken) {
				toast.warning('Circuit number already exists');
				submitting = false;
				return;
			}

			if (load_type) {
				const load_description = `${data.quantity} - ${data.load_description}`;
				const load_data = {
					...data,
					load_description,
					config_preference: load_type,

					...(data.load_type === default_load_types.ONE_P_MOTOR__RATED_HORSE_POWER && {
						varies:
							default_hp_current_relationship[
								data.varies as keyof typeof default_hp_current_relationship
							]
					})
				} as GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
				switch (action) {
					case 'add': {
						const parent_id = panel_id_from_tree as string;
						const added_node = addNode({
							load_data,
							parent_id
						});
						toast.success(`${load_description} added successfully`);
						collapsibles.addNodeId(parent_id);
						undo_redo_state.setActionToUndo({
							data: added_node as unknown as PhaseLoadSchedule,
							action: 'create_node'
						});
						break;
					}
					case 'edit':
						if (node_to_edit && selected_parent_id) {
							const updated_node = updateNode({
								load_data,
								id: node_to_edit.id,
								parent_id: selected_parent_id
							});
							undo_redo_state.setActionToUndo({
								action: 'update_node',
								data: updated_node as unknown as PhaseLoadSchedule,
								previous_data: node_to_edit as PhaseLoadSchedule
							});
							toast.success('Load updated successfully');
						}
						break;
				}
			}
			closeDialog();
		}
		submitting = false;
	}

	const panel_id_from_params = page.params?.id?.split('_')?.at(-1) || ''; //gets the id of the parent node (panel) of the loads

	const variesLabel: VariesLabel | 'Varies' = $derived(
		getInput(form, { path: ['load_type'] })
			? load_type_to_varies_label[getInput(form, { path: ['load_type'] }) as LoadType]
			: 'Varies'
	);

	const quantity_label: QuantityLabel | 'QTY' = $derived(
		getInput(form, { path: ['load_type'] })
			? (load_type_to_quantity_label[getInput(form, { path: ['load_type'] }) as LoadType] ?? 'QTY')
			: 'QTY'
	);

	function initialLoadType() {
		return node_to_edit?.load_data?.config_preference as FormLoadTypeOption | undefined;
	}
	let load_type = $state<FormLoadTypeOption | undefined>(initialLoadType());
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
>
	{#if is_circuit_number_taken}
		<Alert.Root variant="warning">
			<WarningCircleIcon class="size-4" />
			<Alert.Description
				>Circuit number: {taken_circuit_number} is already present.</Alert.Description
			>
		</Alert.Root>
	{/if}
	<div class="mt-2 grid gap-4 sm:grid-cols-2">
		<div class="flex min-w-0 flex-col gap-4">
			<NumberField
				{form}
				path={['circuit_number']}
				label="Circuit number"
				hint="This is the circuit number that will determine the circuit number of the wire to the main."
				placeholder="Enter the circuit number"
				invalid={is_circuit_number_taken}
			/>
			<AmbientTempField {form} />
		</div>

		<div class="flex min-w-0 flex-col gap-4">
			<TerminalTempField
				{form}
				hint="This is the terminal temp that will determine the terminal temp of the wire to the main."
			/>

			<NumberField
				{form}
				path={['length']}
				label="Length"
				hint="This is the length of the load"
				placeholder="Enter the length"
			/>
		</div>
	</div>

	{#if !load_type}
		<div class="my-4 flex items-center justify-center gap-3">
			<Button variant="outline" onclick={() => (load_type = 'DEFAULT')}>Default</Button>
			<Button variant="outline" onclick={() => (load_type = 'CUSTOM')}>Custom</Button>
		</div>
	{/if}
	<div
		transition:scale={{
			delay: 250,
			duration: 200,
			easing: cubicInOut
		}}
	>
		{#if load_type === 'DEFAULT' || load_type === 'CUSTOM'}
			{@render SubFields(load_type)}
			<Separator class="my-4" />
		{/if}
	</div>

	<div class="flex gap-3">
		{#if load_type}
			<Button
				variant="ghost"
				class="shrink-0"
				onclick={() =>
					(load_type =
						load_type === 'DEFAULT' ? 'CUSTOM' : load_type === 'CUSTOM' ? 'DEFAULT' : undefined)}
			>
				Change to {load_type === 'DEFAULT'
					? 'Custom'
					: load_type === 'CUSTOM'
						? 'Default'
						: undefined}
			</Button>
		{/if}
		<Button type="submit" class="min-w-0 flex-1" loading={submitting}>Save</Button>
	</div>
</form>

{#snippet SubFields(load_type: FormLoadTypeOption | undefined)}
	<div class="space-y-4">
		<LoadDescriptionField {form} {load_type} />
		<div class="grid grid-cols-2 gap-4 *:min-w-0 sm:grid-cols-4">
			<NumberField
				{form}
				path={['quantity']}
				label={quantity_label}
				placeholder="Enter {convertToNormalText(quantity_label)}"
			/>
			<VariesField {form} {load_type} varies_label={variesLabel} />
			<LoadTypeField {form} {load_type} />
			<Field of={form} path={['continuous']}>
				{#snippet children(field)}
					<div class="flex min-w-0 flex-col gap-2">
						<Label class={cn(field.errors && 'text-destructive')}>Continuous</Label>
						<div class="flex h-9 items-center">
							<Checkbox
								disabled={load_type === 'DEFAULT'}
								checked={field.input ?? false}
								onCheckedChange={(v) => field.onInput(v)}
							/>
						</div>
					</div>
				{/snippet}
			</Field>
		</div>
	</div>
{/snippet}
