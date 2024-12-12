<script lang="ts" generics="T extends SuperValidated<GenericPhasePanelSchema>">
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import { buttonVariants } from '@/components/ui/button/index.js';
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import * as Alert from '@/components/ui/alert/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';
	import { cn } from '@/utils';
	import { ChevronsUpDown, Check, CircleAlert } from '@/assets/icons';
	import {
		DEFAULT_TERMINAL_TEMPERATURE_OPTIONS,
		DEFAULT_PHASES_OPTIONS,
		DEFAULT_THREE_PHASE_TYPES_OPTIONS
	} from '@/constants';
	import { generic_phase_panel_schema, type GenericPhasePanelSchema } from '@/schema/panel';
	import type { Phase, PhaseType } from '@/types/phase';
	import { convertToNormalText } from '@/utils/text';
	import { addNode, updateNode } from '@/db/mutations';
	import { checkNodeExists } from '@/db/queries';
	import { invalidateAll } from '$app/navigation';
	import type { Node } from '@/types/project';
	import type { TerminalTemperature } from '@/types/load';

	interface Props {
		generic_phase_panel_form: T;
		main_phase: Phase;
		parent_id?: string;
		closeDialog: () => void;
		panel_to_edit?: Node;
		action: 'add' | 'edit';
	}

	let {
		generic_phase_panel_form,
		main_phase,
		parent_id,
		closeDialog,
		panel_to_edit,
		action
	}: Props = $props();

	const form = superForm(generic_phase_panel_form, {
		SPA: true,
		validators: zodClient(generic_phase_panel_schema),
		onUpdate: async ({ form, cancel }) => {
			// toast the values
			if (!form.valid) {
				toast.error('Form is invalid');
				return;
			}

			if (parent_id) {
				is_circuit_number_taken_state.is_circuit_number_taken = await checkNodeExists({
					circuit_number: form.data.circuit_number,
					parent_id,
					node_id: panel_to_edit?.id
				});
				if (is_circuit_number_taken_state.is_circuit_number_taken) {
					cancel();
					toast.warning('Circuit number already exists');
					is_circuit_number_taken_state.circuit_number = form.data.circuit_number;
					return;
				}

				if (action === 'add') await addNode({ parent_id, panel_data: form.data });
				if (action === 'edit' && panel_to_edit) {
					await updateNode({
						panel_data: form.data,
						id: panel_to_edit.id
					});
					toast.success('Panel updated successfully');
				}

				await invalidateAll();
				closeDialog();
			}
		}
	});
	const { form: formData, enhance } = form;

	$effect(() => {
		if (panel_to_edit && panel_to_edit.panel_data) {
			const {
				circuit_number,
				panel_data: { terminal_temperature, phase, name }
			} = panel_to_edit;

			$formData.circuit_number = circuit_number as number;
			$formData.name = name;
			$formData.terminal_temperature = terminal_temperature as TerminalTemperature;
			$formData.phase = phase as Phase;
		}
	});

	let open_panel_phase_popover = $state(false);
	let open_terminal_temp = $state(false);
	let open_phase_type = $state(false);
	let is_circuit_number_taken_state = $state({
		is_circuit_number_taken: false,
		circuit_number: 0
	});

	const phase_trigger_id = useId();
	const panel_phase_type_trigger_id = useId();
	const terminal_temp_trigger_id = useId();

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_terminal_temp = false;
		open_panel_phase_popover = false;
		open_phase_type = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<form method="POST" use:enhance>
	{#if is_circuit_number_taken_state.is_circuit_number_taken}
		<Alert.Root variant="warning">
			<CircleAlert class="size-4" />
			<Alert.Description
				>Circuit number: {is_circuit_number_taken_state.circuit_number} is already present.</Alert.Description
			>
		</Alert.Root>
	{/if}
	<div class="grid grid-cols-2 gap-2">
		<div>
			<Form.Field {form} name="name">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Name</Form.Label>
						<Input {...props} bind:value={$formData.name} placeholder="Enter panel name" />
					{/snippet}
				</Form.Control>
				<Form.Description>This is the panel name.</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="circuit_number">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Circuit number</Form.Label>
						<Input
							{...props}
							type="number"
							inputmode="numeric"
							min={1}
							bind:value={$formData.circuit_number}
							placeholder="Enter the circuit number"
						/>
					{/snippet}
				</Form.Control>
				<Form.Description>
					This is the circuit number that will determine the circuit number of the wire to the main.
				</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="terminal_temperature" class="mt-2.5 flex flex-col">
				<Popover.Root bind:open={open_terminal_temp}>
					<Form.Control id={terminal_temp_trigger_id}>
						{#snippet children({ props })}
							<Form.Label>Terminal Temperature</Form.Label>
							<Popover.Trigger
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'justify-between',
									!$formData.terminal_temperature && 'text-muted-foreground'
								)}
								role="combobox"
								{...props}
							>
								{$formData.terminal_temperature
									? convertToNormalText(
											DEFAULT_TERMINAL_TEMPERATURE_OPTIONS.find(
												(f) => f === $formData.terminal_temperature
											)
										)
									: 'Select a terminal temperature'}
								<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<input hidden value={$formData.terminal_temperature} name={props.name} />
						{/snippet}
					</Form.Control>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search a terminal temp..." class="h-9" />
							<Command.Empty>No terminal temp found.</Command.Empty>
							<Command.Group>
								{#each DEFAULT_TERMINAL_TEMPERATURE_OPTIONS as ambient_temp}
									<Command.Item
										value={ambient_temp}
										onSelect={() => {
											$formData.terminal_temperature = ambient_temp;
											closeAndFocusTrigger(terminal_temp_trigger_id);
										}}
									>
										{convertToNormalText(ambient_temp)}
										<Check
											class={cn(
												'ml-auto size-4',
												ambient_temp !== $formData.terminal_temperature && 'text-transparent'
											)}
										/>
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<Form.Description>
					This is the terminal temp that will determine the terminal temp of the panel wire to the
					main.
				</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
		</div>
		{#if main_phase !== '1P'}
			<div>
				{@render PanelType()}
				{@render PanelPhase()}
			</div>
		{:else}
			<div>
				{@render PanelPhase()}
			</div>
		{/if}
	</div>
	<Form.Button class="w-full" type="submit">Save</Form.Button>
</form>

{#snippet PanelType()}
	<Form.Field {form} name="type" class="mt-2.5 flex flex-col">
		<Popover.Root bind:open={open_phase_type}>
			<Form.Control id="phase_trigger_id">
				{#snippet children({ props })}
					<Form.Label>Type</Form.Label>
					<Popover.Trigger
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'justify-between',
							!$formData.type && 'text-muted-foreground'
						)}
						role="combobox"
						{...props}
					>
						{$formData.type
							? convertToNormalText(
									DEFAULT_THREE_PHASE_TYPES_OPTIONS.find((f) => f === $formData.type)
								)
							: 'Select a panel phase type'}
						<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<input hidden value={$formData.type} name={props.name} />
				{/snippet}
			</Form.Control>
			<Popover.Content class="w-auto p-0">
				<Command.Root>
					<Command.Input autofocus placeholder="Search panel phase type..." class="h-9" />
					<Command.Empty>No panel phase type found.</Command.Empty>
					<Command.Group>
						{#each DEFAULT_THREE_PHASE_TYPES_OPTIONS as phase_type_option}
							<Command.Item
								value={phase_type_option}
								onSelect={() => {
									$formData.type = phase_type_option;
									closeAndFocusTrigger(panel_phase_type_trigger_id);
								}}
							>
								{convertToNormalText(phase_type_option)}
								<Check
									class={cn(
										'ml-auto size-4',
										phase_type_option !== $formData.type && 'text-transparent'
									)}
								/>
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
		<Form.Description>This is the type for the panel.</Form.Description>
		<Form.FieldErrors />
	</Form.Field>
{/snippet}

{#snippet PanelPhase()}
	{@const is_one_phase = main_phase === '1P'}
	<Form.Field
		{form}
		name="phase"
		class={cn('mt-2.5 flex flex-col', {
			'cursor-not-allowed': is_one_phase
		})}
	>
		<Popover.Root bind:open={open_panel_phase_popover}>
			<Form.Control id="panel_phase_trigger_id">
				{#snippet children({ props })}
					<Form.Label>Phase</Form.Label>
					<Popover.Trigger
						disabled={is_one_phase}
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'justify-between',
							!$formData.phase && 'text-muted-foreground'
						)}
						role="combobox"
						{...props}
					>
						{$formData.phase
							? DEFAULT_PHASES_OPTIONS.find((f) => f === $formData.phase)
							: 'Select a phase'}
						<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<input hidden value={$formData.phase} name={props.name} />
				{/snippet}
			</Form.Control>
			<Popover.Content class="w-auto p-0">
				<Command.Root>
					<Command.Input autofocus placeholder="Search a panel phase..." class="h-9" />
					<Command.Empty>No panel phase found.</Command.Empty>
					<Command.Group>
						{#each DEFAULT_PHASES_OPTIONS as phase_option}
							<Command.Item
								value={phase_option}
								onSelect={() => {
									$formData.phase = phase_option;
									closeAndFocusTrigger(phase_trigger_id);
								}}
							>
								{phase_option}
								<Check
									class={cn(
										'ml-auto size-4',
										phase_option !== $formData.phase && 'text-transparent'
									)}
								/>
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
		<Form.Description>This is the phase for the panel.</Form.Description>
		<Form.FieldErrors />
	</Form.Field>
{/snippet}
