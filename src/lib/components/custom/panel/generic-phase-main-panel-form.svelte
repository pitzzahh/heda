<script lang="ts" module>
	import type { CoordinationSystem } from '#lib/types/coordination.js';

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
	import { WarningCircleIcon } from '#lib/assets/icons.js';
	import { createForm, Field, getInput, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { cn } from '#lib/utils/index.js';
	import { default_phases } from '#lib/constants.js';
	import {
		AmbientTempField,
		NumberField,
		TerminalTempField
	} from '#lib/components/custom/fields/index.js';
	import { PanelPhaseField, PanelSystemField } from './(components)/index.js';
	import { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel.js';
	import type { Phase } from '#lib/types/phase.js';
	import { addNode, updateNode } from '#lib/db/mutations/index.js';
	import { checkNodeExists } from '#lib/db/queries/index.js';
	import type { Node } from '#lib/types/db.js';
	import type { TerminalTemperature } from '#lib/types/load.js';
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
			length: node_to_edit.length,
			system: (node_to_edit.panel_data.system ?? null) as CoordinationSystem | null
		};
	}

	const form = createForm({
		schema: GENERIC_PHASE_PANEL_SCHEMA,
		initialInput: buildInitialInput()
	});

	let taken_circuit_number = $state(0);
	let submitting = $state(false);
	const form_id = $props.id();
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

			// The engine refuses a panel its supply cannot feed (PEC 2017 2.20.1.5(A)).
			if (action === 'add') {
				const { error } = await addNode({ parent_id, panel_data: data });
				if (error) return refuse(error);
				toast.success(`${data.name} added successfully`);
				collapsibles.addNodeId(parent_id);
			} else if (node_to_edit && selected_parent_id) {
				const { error } = await updateNode({
					panel_data: data,
					id: node_to_edit.id,
					parent_id: selected_parent_id
				});
				if (error) return refuse(error);
				toast.success('Panel updated successfully');
			}

			closeDialog();
		}
		submitting = false;
	}

	function refuse(error: string) {
		toast.error(error);
		submitting = false;
	}
</script>

<form
	id={form_id}
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
	<!-- One grid, not two stacked columns, so each pair of fields shares a row. -->
	<div class="grid items-start gap-4 *:min-w-0 sm:grid-cols-2">
		<Field of={form} path={['name']}>
			{#snippet children(field)}
				<div class="space-y-2">
					<Label class={cn(field.errors && 'text-destructive')}>Name</Label>
					<Input {...field.props} value={field.input ?? ''} placeholder="Enter panel name" />
					<p class="text-[0.8rem] text-muted-foreground">This is the panel name.</p>
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
		<!-- The phase already says wye or delta, so the panel type picker stays hidden. -->
		<PanelPhaseField {form} {main_phase} />
		<NumberField
			{form}
			path={['circuit_number']}
			label="Circuit number"
			hint="This is the circuit number that will determine the circuit number of the wire to the main."
			placeholder="Enter the circuit number"
		/>
		<NumberField
			{form}
			path={['length']}
			label="Length"
			hint="This is the length of the panel"
			placeholder="Enter the length"
		/>
		<TerminalTempField
			{form}
			hint="Standard (PEC 2017 1.10.1.14(C)(1)): the conductor terminates at its 60 °C ampacity on circuits of 100 A or less, and at its 75 °C ampacity above."
		/>
		<AmbientTempField {form} />
		<PanelSystemField {form} />
	</div>
</form>

<!-- The footer sits outside the scroll area, so drawers keep Save in reach. -->
<Dialog.Footer>
	<Button type="button" variant="ghost" onclick={closeDialog}>Cancel</Button>
	<Button
		type="submit"
		form={form_id}
		loading={submitting}
		disabled={action === 'edit' && !form.isDirty}>Save</Button
	>
</Dialog.Footer>
