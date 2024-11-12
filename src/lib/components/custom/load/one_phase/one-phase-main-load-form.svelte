<script lang="ts" generics="T extends SuperValidated<OnePhaseMainLoadSchema>">
	import { goto } from '$app/navigation';
	import { scale } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { Separator } from '@/components/ui/separator/index.js';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import { Checkbox } from '@/components/ui/checkbox/index.js';
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';
	import { cn } from '@/utils';
	import { CaretSort, Check } from '@/assets/icons/radix';
	import { ambient_temperatures, specials } from '@/constants';
	import type { LoadType } from '@/types/load';
	import { one_phase_main_load_schema, type OnePhaseMainLoadSchema } from '@/schema/load/one_phase';

	interface Props {
		one_phase_main_load_form: T;
		saved_path?: string;
	}

	let { one_phase_main_load_form }: Props = $props();

	const form = superForm(one_phase_main_load_form, {
		SPA: true,
		validators: zodClient(one_phase_main_load_schema),
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
	let open_special = $state(false);
	const ambient_temp_trigger_id = useId();
	const special_trigger_id = useId();
	let load_type = $state<LoadType | undefined>();

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_ambient_temp = false;
		open_special = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<form method="POST" use:enhance>
	<div class="grid grid-cols-2 place-items-start justify-between gap-2">
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
		<Form.Field {form} name="load_ambient_temperature" class="mt-2.5 flex flex-col">
			<Popover.Root bind:open={open_ambient_temp}>
				<Form.Control id={ambient_temp_trigger_id}>
					{#snippet children({ props })}
						<Form.Label>Ambient Temperature</Form.Label>
						<Popover.Trigger
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'justify-between',
								!$formData.load_ambient_temperature && 'text-muted-foreground'
							)}
							role="combobox"
							{...props}
						>
							{ambient_temperatures.find((f) => f.value === $formData.load_ambient_temperature)
								?.label ?? 'Select an ambient temperature'}
							<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
						</Popover.Trigger>
						<input hidden value={$formData.load_ambient_temperature} name={props.name} />
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
										$formData.load_ambient_temperature = ambient_temp.value;
										closeAndFocusTrigger(ambient_temp_trigger_id);
									}}
								>
									{ambient_temp.label}
									<Check
										class={cn(
											'ml-auto size-4',
											ambient_temp.value !== $formData.load_ambient_temperature &&
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
				This is the ambient temp that will determine the ambient temp of the wire to the main.
			</Form.Description>
			<Form.FieldErrors />
		</Form.Field>
	</div>

	{#if !load_type}
		<div class="my-2 flex items-center justify-around gap-2">
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
			<Separator class="my-2" />
		{/if}
		{#if load_type === 'DEFAULT'}
			{@render SubFields()}
		{/if}
		{#if load_type === 'CUSTOM'}
			{@render SubFields()}
		{/if}
		{#if load_type === 'DEFAULT' || load_type === 'CUSTOM'}
			<Separator class="my-2" />
		{/if}
	</div>

	<Form.Button class="w-full">Save</Form.Button>
</form>

{#snippet SubFields()}
	<div class="flex justify-between gap-1">
		<Form.Field {form} name="quantity" class="w-28 text-center">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>QTY</Form.Label>
					<Input
						{...props}
						type="number"
						min={1}
						inputmode="numeric"
						bind:value={$formData.quantity}
						placeholder="Enter quantity"
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="load_description" class="w-full text-center">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Load description</Form.Label>
					<Input
						{...props}
						bind:value={$formData.load_description}
						placeholder="Enter load description"
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="varies" class="text-center">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Varies</Form.Label>
					<Input
						{...props}
						type="number"
						inputmode="numeric"
						min={1}
						bind:value={$formData.varies}
						placeholder="Enter varies"
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="continuous" class="mt-2 grid text-center">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Continuous</Form.Label>
					<Checkbox {...props} bind:checked={$formData.continuous} />
					<input name={props.name} value={$formData.continuous} hidden />
				{/snippet}
			</Form.Control>
		</Form.Field>
		<Form.Field {form} name="special" class="mt-2 grid text-center">
			<Popover.Root bind:open={open_special}>
				<Form.Control id={special_trigger_id}>
					{#snippet children({ props })}
						<Form.Label>Special</Form.Label>
						<Popover.Trigger
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'justify-between',
								!$formData.special && 'text-muted-foreground'
							)}
							role="combobox"
							{...props}
						>
							{specials.find((s) => s.value === $formData.special)?.label ?? 'Select an special'}
							<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
						</Popover.Trigger>
						<input hidden value={$formData.special} name={props.name} />
					{/snippet}
				</Form.Control>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Input autofocus placeholder="Search a special..." class="h-9" />
						<Command.Empty>No special found.</Command.Empty>
						<Command.Group>
							{#each specials as special}
								<Command.Item
									value={special.value}
									onSelect={() => {
										$formData.special = special.value;
										closeAndFocusTrigger(special_trigger_id);
									}}
								>
									{special.label}
									<Check
										class={cn(
											'ml-auto size-4',
											special.value !== $formData.special && 'text-transparent'
										)}
									/>
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
			<Form.FieldErrors />
		</Form.Field>
	</div>
{/snippet}
