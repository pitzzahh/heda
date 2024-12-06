<script lang="ts" generics="T extends SuperValidated<GenericPhasePanelSchema>">
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import { buttonVariants } from '@/components/ui/button/index.js';
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';
	import { cn } from '@/utils';
	import { CaretSort, Check } from '@/assets/icons/radix';
	import {
		ambient_temperatures,
		DEFAULT_PHASES_OPTIONS,
		DEFAULT_THREE_PHASE_TYPES_OPTIONS
	} from '@/constants';
	import { generic_phase_panel_schema, type GenericPhasePanelSchema } from '@/schema/panel';
	import { MISC_STATE_CTX } from '@/state/constants';
	import { getState } from '@/state/index.svelte';
	import type { MiscState } from '@/state/types';
	import type { Phase } from '@/types/phase';
	import { convertToNormalText } from '@/utils/text';
	import { addNode } from '@/db/mutations';

	interface Props {
		generic_phase_panel_form: T;
		main_phase: Phase;
		open_panel_dialog: boolean;
		parent_id?: string;
		id?: string;
		is_parent_root_node: boolean;
	}

	let {
		generic_phase_panel_form,
		main_phase,
		open_panel_dialog = $bindable(),
		parent_id,
		id,
		is_parent_root_node = false
	}: Props = $props();

	const form = superForm(generic_phase_panel_form, {
		SPA: true,
		validators: zodClient(generic_phase_panel_schema),
		onUpdate: async ({ form }) => {
			// toast the values
			if (form.valid) {
				if (parent_id) {
					addNode({ parent_id, is_parent_root_node, panel_data: form.data });
				}

				toast.success('Form is valid');
				open_panel_dialog = false;
			} else {
				toast.error('Form is invalid');
			}
		}
	});
	const { form: formData, enhance } = form;
	const miscState = getState<MiscState>(MISC_STATE_CTX);

	let open_panel_phase_popover = $state(false);
	let open_ambient_temp = $state(false);
	let open_phase_type = $state(false);
	const phase_trigger_id = useId();

	const panel_phase_type_trigger_id = useId();
	const ambient_temp_trigger_id = useId();

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_ambient_temp = false;
		open_panel_phase_popover = false;
		open_phase_type = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}

	$effect(() => {
		miscState.form_data = {
			data: $formData,
			label: 'One phase main panel form'
		};
	});
</script>

<form method="POST" use:enhance>
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
			<Form.Field {form} name="ambient_temperature" class="mt-2.5 flex flex-col">
				<Popover.Root bind:open={open_ambient_temp}>
					<Form.Control id={ambient_temp_trigger_id}>
						{#snippet children({ props })}
							<Form.Label>Ambient Temperature</Form.Label>
							<Popover.Trigger
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'justify-between',
									!$formData.ambient_temperature && 'text-muted-foreground'
								)}
								role="combobox"
								{...props}
							>
								{ambient_temperatures.find((f) => f.value === $formData.ambient_temperature)
									?.label ?? 'Select an ambient temperature'}
								<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<input hidden value={$formData.ambient_temperature} name={props.name} />
						{/snippet}
					</Form.Control>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search an ambient temp..." class="h-9" />
							<Command.Empty>No ambient temp found.</Command.Empty>
							<Command.Group>
								{#each ambient_temperatures as ambient_temp}
									<Command.Item
										value={ambient_temp.value}
										onSelect={() => {
											$formData.ambient_temperature = ambient_temp.value;
											closeAndFocusTrigger(ambient_temp_trigger_id);
										}}
									>
										{ambient_temp.label}
										<Check
											class={cn(
												'ml-auto size-4',
												ambient_temp.value !== $formData.ambient_temperature && 'text-transparent'
											)}
										/>
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<Form.Description>
					This is the ambient temp that will determine the ambient temp of the panel wire to the
					main.
				</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
		</div>
		{#if main_phase !== 'ONE_PHASE'}
			<div>
				{@render PanelType()}
				{@render PanelPhase()}
			</div>
		{/if}
		<div>
			{@render PanelPhase()}
		</div>
	</div>
	<Form.Button class="w-full">Save</Form.Button>
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
						{convertToNormalText(
							DEFAULT_THREE_PHASE_TYPES_OPTIONS.find((f) => f === $formData.type)
						) ?? 'Select a panel phase type'}
						<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
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
	<Form.Field {form} name="phase" class="mt-2.5 flex flex-col">
		<Popover.Root bind:open={open_panel_phase_popover}>
			<Form.Control id="panel_phase_trigger_id">
				{#snippet children({ props })}
					<Form.Label>Phase</Form.Label>
					<Popover.Trigger
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'justify-between',
							!$formData.phase && 'text-muted-foreground'
						)}
						role="combobox"
						{...props}
					>
						{convertToNormalText(DEFAULT_PHASES_OPTIONS.find((f) => f === $formData.phase)) ??
							'Select a panel phase'}
						<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<input hidden value={$formData.phase} name={props.name} />
				{/snippet}
			</Form.Control>
			<Popover.Content class="w-auto p-0">
				<Command.Root>
					<Command.Input autofocus placeholder="Search an ambient temp..." class="h-9" />
					<Command.Empty>No ambient temp found.</Command.Empty>
					<Command.Group>
						{#each DEFAULT_PHASES_OPTIONS as phase_option}
							<Command.Item
								value={phase_option}
								onSelect={() => {
									$formData.phase = phase_option;
									closeAndFocusTrigger(phase_trigger_id);
								}}
							>
								{convertToNormalText(phase_option)}
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
