<script lang="ts" generics="T extends SuperValidated<HighestUnitSchema>">
	import { goto } from '$app/navigation';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import * as RadioGroup from '@/components/ui/radio-group/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import { tick } from 'svelte';
	import { useId } from 'bits-ui';
	import { cn } from '@/utils';
	import { buttonVariants } from '@/components/ui/button';
	import { CaretSort, Check } from '@/assets/icons/radix';
	import { type HighestUnitSchema, highest_unit_schema } from '@/schema';
	import { ambient_temperatures } from '@/constants';

	interface Props {
		highest_unit_form: T;
	}

	let { highest_unit_form }: Props = $props();

	const form = superForm(highest_unit_form, {
		SPA: true,
		validators: zodClient(highest_unit_schema),
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

	let open_ambient_temp = $state(false);
	const ambient_temp_trigger_id = useId();

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_ambient_temp = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<form method="POST" use:enhance>
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-1">
			<Form.Field {form} name="distribution_unit">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Distribution unit</Form.Label>
						<Input
							{...props}
							bind:value={$formData.distribution_unit}
							placeholder="Enter the distribution unit name"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="ambient_temp" class="col-span-2 flex flex-col">
				<Popover.Root bind:open={open_ambient_temp}>
					<Form.Control id={ambient_temp_trigger_id}>
						{#snippet children({ props })}
							<Form.Label>Ambient Temperature</Form.Label>
							<Popover.Trigger
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'justify-between',
									!$formData.ambient_temp && 'text-muted-foreground'
								)}
								role="combobox"
								{...props}
							>
								{ambient_temperatures.find((f) => f.value === $formData.ambient_temp)?.label ??
									'Select an ambient temperature'}
								<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<input hidden value={$formData.ambient_temp} name={props.name} />
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
											$formData.ambient_temp = ambient_temp.value;
											closeAndFocusTrigger(ambient_temp_trigger_id);
										}}
									>
										{ambient_temp.label}
										<Check
											class={cn(
												'ml-auto size-4',
												ambient_temp.value !== $formData.ambient_temp && 'text-transparent'
											)}
										/>
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<Form.Description>
					This is the ambient temp that will determine the ambient temp of the wire to the main.
				</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
		</div>
		<div class="flex flex-col gap-1">
			<Form.Field {form} name="wire_length">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Wire length (m)</Form.Label>
						<Input
							{...props}
							type="number"
							inputmode="numeric"
							bind:value={$formData.wire_length}
							placeholder="Enter the wire length"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors />
			</Form.Field>
		</div>
		<Form.Fieldset {form} name="phase" class="col-span-2 space-y-3">
			<Form.Legend>Select a phase</Form.Legend>
			<RadioGroup.Root bind:value={$formData.phase} class="flex flex-col space-y-1" name="phase">
				<div class="flex items-center space-x-3 space-y-0">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label
								class={buttonVariants({
									variant: 'outline',
									className: 'w-full font-normal [&:has([data-state=checked])]:bg-muted'
								})}
							>
								<RadioGroup.Item value="one_phase" {...props} class="sr-only" />
								1 Phase
							</Form.Label>
						{/snippet}
					</Form.Control>
				</div>
				<div class="flex items-center space-x-3 space-y-0">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label
								class={buttonVariants({
									variant: 'outline',
									className: 'w-full font-normal  [&:has([data-state=checked])]:bg-muted'
								})}
							>
								<RadioGroup.Item value="three_phase_wye" {...props} class="sr-only" />
								3 Phase Wye
							</Form.Label>
						{/snippet}
					</Form.Control>
				</div>
				<div class="flex items-center space-x-3 space-y-0">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label
								class={buttonVariants({
									variant: 'outline',
									className: 'w-full font-normal [&:has([data-state=checked])]:bg-muted'
								})}
							>
								<RadioGroup.Item value="three_phase_delta" {...props} class="sr-only" />
								3 Phase Delta</Form.Label
							>
						{/snippet}
					</Form.Control>
				</div>
			</RadioGroup.Root>
			<Form.FieldErrors />
		</Form.Fieldset>
	</div>
	<Form.Button class="w-full">Proceed</Form.Button>
</form>
