<script lang="ts" generics="T extends SuperValidated<GenericPanelSchema>">
	import { goto } from '$app/navigation';
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
	import type { LoadType } from '@/types/load';
	import { generic_panel_schema, type GenericPanelSchema } from '@/schema/panel';
	import { MISC_STATE_CTX } from '@/state/constants';
	import { getState } from '@/state/index.svelte';
	import type { MiscState } from '@/state/types';

	interface Props {
		one_phase_main_load_form: T;
		saved_path?: string;
	}

	let { one_phase_main_load_form }: Props = $props();

	const form = superForm(one_phase_main_load_form, {
		SPA: true,
		validators: zodClient(generic_panel_schema),
		onUpdate: ({ form }) => {
			// toast the values
			if (form.valid) {
				toast.success('Form is valid');
				goto('/home');
			} else {
				toast.error('Form is invalid');
			}
		}
	});
	const { form: formData, enhance } = form;
	const miscState = getState<MiscState>(MISC_STATE_CTX);

	let open_panel_phase_popover = $state(false);
	let open_panel_phase_type = $state(false);

	let open_load_description = $state(false);

	const panel_phase_trigger_id = useId();
	const panel_phase_type_trigger_id = useId();

	const load_description_trigger_id = useId();

	let load_type = $state<LoadType | undefined>();

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_panel_phase_popover = false;
		open_panel_phase_type = false;
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
	<div class="grid grid-cols-2 place-items-start justify-between gap-2">
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
		<Form.Field {form} name="panel_ambient_temperature" class="mt-2.5 flex flex-col">
			<Popover.Root bind:open={open_panel_phase_popover}>
				<Form.Control id={panel_phase_trigger_id}>
					{#snippet children({ props })}
						<Form.Label>Ambient Temperature</Form.Label>
						<Popover.Trigger
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'justify-between',
								!$formData.panel_ambient_temperature && 'text-muted-foreground'
							)}
							role="combobox"
							{...props}
						>
							{ambient_temperatures.find((f) => f.value === $formData.panel_ambient_temperature)
								?.label ?? 'Select an ambient temperature'}
							<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
						</Popover.Trigger>
						<input hidden value={$formData.panel_ambient_temperature} name={props.name} />
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
										$formData.panel_ambient_temperature = ambient_temp.value;
										closeAndFocusTrigger(panel_phase_trigger_id);
									}}
								>
									{ambient_temp.label}
									<Check
										class={cn(
											'ml-auto size-4',
											ambient_temp.value !== $formData.panel_ambient_temperature &&
												'text-transparent'
										)}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<Form.Description>
				This is the ambient temp that will determine the ambient temp of the panel wire to the main.
			</Form.Description>
			<Form.FieldErrors />
		</Form.Field>
	</div>
	<div class="flex flex-col items-center gap-1">
		{#if $formData.main_phase !== 'one_phase'}
			<div class="row-start-1">
				{@render PanelPhase()}
			</div>
		{/if}

		<div class="row-start-2">
			{@render PanelType()}
		</div>
	</div>

	<Form.Button class="w-full">Save</Form.Button>
</form>

{#snippet PanelType()}
	<Form.Field {form} name="panel_type" class="mt-2.5 flex flex-col">
		<Popover.Root bind:open={open_panel_phase_type}>
			<Form.Control id="panel_phase_trigger_id">
				{#snippet children({ props })}
					<Form.Label>Type</Form.Label>
					<Popover.Trigger
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'justify-between',
							!$formData.panel_type && 'text-muted-foreground'
						)}
						role="combobox"
						{...props}
					>
						{DEFAULT_THREE_PHASE_TYPES_OPTIONS.find((f) => f === $formData.panel_type) ??
							'Select a panel phase type'}
						<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<input hidden value={$formData.panel_type} name={props.name} />
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
									$formData.panel_type = phase_type_option;
									closeAndFocusTrigger(panel_phase_type_trigger_id);
								}}
							>
								{phase_type_option}
								<Check
									class={cn(
										'ml-auto size-4',
										phase_type_option !== $formData.panel_type && 'text-transparent'
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
	<Form.Field {form} name="panel_phase" class="mt-2.5 flex flex-col">
		<Popover.Root bind:open={open_panel_phase_popover}>
			<Form.Control id="panel_phase_trigger_id">
				{#snippet children({ props })}
					<Form.Label>Phase</Form.Label>
					<Popover.Trigger
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'justify-between',
							!$formData.panel_phase && 'text-muted-foreground'
						)}
						role="combobox"
						{...props}
					>
						{DEFAULT_PHASES_OPTIONS.find((f) => f === $formData.panel_phase) ??
							'Select a panel phase'}
						<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<input hidden value={$formData.panel_phase} name={props.name} />
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
									$formData.panel_phase = phase_option;
									closeAndFocusTrigger(panel_phase_trigger_id);
								}}
							>
								{phase_option}
								<Check
									class={cn(
										'ml-auto size-4',
										phase_option !== $formData.panel_phase && 'text-transparent'
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
