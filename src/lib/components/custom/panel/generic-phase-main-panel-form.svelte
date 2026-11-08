<script lang="ts" module>
	interface Props {
		main_phase: Phase;
		parent_id?: string;
		closeDialog: () => void;
		node_to_edit?: Node;
		action: 'add' | 'edit';
		selected_parent_id?: string;
		latest_circuit_node?: Node;
	}
</script>

<script lang="ts">
	import { WarningCircleIcon } from '#lib/assets/icons/index.js';
	import { createForm, Field, getInput, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { cn } from '#lib/utils/index.js';
	import { default_phases } from '#lib/constants/index.js';
	import {
		AmbientTempField,
		NumberField,
		TerminalTempField
	} from '#lib/components/custom/fields/index.js';
	import { PanelPhaseField, PanelTypeField } from './(components)/index.js';
	import { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel/index.js';
	import type { Phase } from '#lib/types/phase/index.js';
	import { addNode, updateNode } from '#lib/db/mutations/index.js';
	import { checkNodeExists } from '#lib/db/queries/index.js';
	import type { Node } from '#lib/types/db/index.js';
	import type { TerminalTemperature } from '#lib/types/load/index.js';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte.js';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase/index.js';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte.js';

	let {
		main_phase,
		parent_id,
		closeDialog,
		node_to_edit,
		action,
		latest_circuit_node,
		selected_parent_id
	}: Props = $props();

	let undo_redo_state = getUndoRedoState();
	let collapsibles = getCollapsiblesState();

	// Snapshot of props at mount: initial form values never track later prop changes.
	function buildInitialInput() {
		if (action !== 'edit')
			// A 1P supply can only feed 1P panels: preselect it since the trigger is locked.
			return {
				circuit_number: (latest_circuit_node?.circuit_number ?? 0) + 1,
				...(main_phase === default_phases.ONE_PHASE ? { phase: default_phases.ONE_PHASE } : {})
			};
		if (!node_to_edit || !node_to_edit.panel_data) {
			// TODO: Log system error
			toast.warning('Failed to identify the panel to edit', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return {};
		}
		return {
			circuit_number: node_to_edit.circuit_number,
			name: node_to_edit.panel_data.name ?? 'Unknown',
			terminal_temperature: node_to_edit.panel_data.terminal_temperature as TerminalTemperature,
			phase: node_to_edit.panel_data.phase as Phase,
			ambient_temperature: node_to_edit.panel_data.ambient_temperature,
			length: node_to_edit.length
		};
	}

	const form = createForm({
		schema: GENERIC_PHASE_PANEL_SCHEMA,
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

		if (parent_id) {
			taken_circuit_number = checkNodeExists({
				circuit_number: data.circuit_number,
				//we want to check if the circuit number is alrdy existing in the parent we want to move in
				parent_id: selected_parent_id || parent_id,
				node_id: node_to_edit?.id
			})
				? data.circuit_number
				: 0;

			if (is_circuit_number_taken) {
				toast.warning('Circuit number already exists');
				submitting = false;
				return;
			}

			switch (action) {
				case 'add': {
					const added_node = addNode({ parent_id, panel_data: data });
					toast.success(`${data.name} added successfully`);
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
							panel_data: data,
							id: node_to_edit.id,
							parent_id: selected_parent_id
						});
						toast.success('Panel updated successfully');
						undo_redo_state.setActionToUndo({
							data: updated_node as unknown as PhaseLoadSchedule,
							previous_data: node_to_edit as PhaseLoadSchedule,
							action: 'update_node'
						});
					}
					break;
			}

			closeDialog();
		}
		submitting = false;
	}
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
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-2.5">
			<Field of={form} path={['name']}>
				{#snippet children(field)}
					<div class="space-y-2">
						<Label class={cn(field.errors && 'text-destructive')}>Name</Label>
						<Input {...field.props} value={field.input ?? ''} placeholder="Enter panel name" />
						<p class="text-muted-foreground text-[0.8rem]">This is the panel name.</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
			<NumberField
				{form}
				path={['circuit_number']}
				label="Circuit number"
				hint="This is the circuit number that will determine the circuit number of the wire to the main."
				placeholder="Enter the circuit number"
			/>
			<TerminalTempField
				{form}
				hint="This is the terminal temp that will determine the terminal temp of the panel wire to the main."
			/>
		</div>

		<div class="flex flex-col gap-2.5">
			{#if main_phase !== default_phases.ONE_PHASE}
				<PanelTypeField {form} />
				<PanelPhaseField {form} {main_phase} />
			{:else}
				<PanelPhaseField {form} {main_phase} />
			{/if}
			<AmbientTempField {form} />

			<NumberField
				{form}
				path={['length']}
				label="Length"
				hint="This is the length of the panel"
				placeholder="Enter the length"
			/>
		</div>
	</div>
	<Button type="submit" class="w-full" loading={submitting}>Save</Button>
</form>
