<script lang="ts" generics="T extends SuperValidated<PhaseMainLoadSchema>">
	import { scale } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { Separator } from '@/components/ui/separator/index.js';
	import SuperDebug, { superForm, type SuperValidated } from 'sveltekit-superforms';
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
	import {
		DEFAULT_AMBIENT_TEMPERATURE_OPTIONS,
		default_loads_description,
		specials
	} from '@/constants';
	import type { LoadType } from '@/types/load';
	import { phase_main_load_schema, type PhaseMainLoadSchema } from '@/schema/load';
	import { page } from '$app/stores';
	import { addNode } from '@/db/mutations';
	import { checkNodeExists } from '@/db/queries';
	import { invalidateAll } from '$app/navigation';
	import { convertToNormalText } from '@/utils/text';

	interface Props {
		phase_main_load_form: T;
		saved_path?: string;
		closeDialog: () => void;
	}

	let { phase_main_load_form, closeDialog }: Props = $props();
	let panel_id = $page.params.id.split('_').at(-1); //gets the id of the parent node (panel) of the loads

	const form = superForm(phase_main_load_form, {
		SPA: true,
		validators: zodClient(phase_main_load_schema),
		onUpdate: async ({ form, cancel }) => {
			if (!form.valid) {
				toast.error('Form is invalid');
				return;
			}

			if (panel_id) {
				if (await checkNodeExists(form.data.circuit_number, panel_id)) {
					cancel();
					toast.warning('Circuit number already exists');
					return;
				}
				await addNode({ load_data: form.data, parent_id: panel_id });
				await invalidateAll();
				closeDialog();
			}
		}
	});
	const { form: formData, enhance } = form;

	let open_ambient_temp = $state(false);
	let open_special = $state(false);
	let open_load_description = $state(false);
	const ambient_temp_trigger_id = useId();
	const special_trigger_id = useId();
	const load_description_trigger_id = useId();
	let load_type = $state<LoadType | undefined>();

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_ambient_temp = false;
		open_special = false;
		open_load_description = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}
</script>

<form method="POST" use:enhance>
	<!-- <Form.Field {form} name="distribution_unit" class="sr-only text-center">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>Distribution unit</Form.Label>
				<Input
					{...props}
					type="number"
					min={1}
					inputmode="numeric"
					bind:value={$formData.distribution_unit}
					placeholder="Enter distribution_unit"
				/>
			{/snippet}
		</Form.Control>
		<Form.FieldErrors />
	</Form.Field> -->
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
		<Form.Field {form} name="load_ambient_temperature" class="mt-2 flex flex-col">
			<Popover.Root bind:open={open_ambient_temp}>
				<Form.Control id={ambient_temp_trigger_id}>
					{#snippet children({ props })}
						<Form.Label class="mb-0.5">Ambient Temperature</Form.Label>
						<Popover.Trigger
							class={cn(
								buttonVariants({ variant: 'outline' }),
								'justify-between',
								!$formData.load_ambient_temperature && 'text-muted-foreground'
							)}
							role="combobox"
							{...props}
						>
							{convertToNormalText(
								DEFAULT_AMBIENT_TEMPERATURE_OPTIONS.find(
									(f) => f === $formData.load_ambient_temperature
								)
							) ?? 'Select an ambient temperature'}
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
							{#each DEFAULT_AMBIENT_TEMPERATURE_OPTIONS as ambient_temp}
								<Command.Item
									value={ambient_temp}
									onSelect={() => {
										$formData.load_ambient_temperature = ambient_temp;
										closeAndFocusTrigger(ambient_temp_trigger_id);
									}}
								>
									{convertToNormalText(ambient_temp)}
									<Check
										class={cn(
											'ml-auto size-4',
											ambient_temp !== $formData.load_ambient_temperature && 'text-transparent'
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
			{@render SubFields(load_type)}
			<Separator class="my-2" />
		{/if}
	</div>

	<div class="flex gap-2">
		{#if load_type}
			<Button
				variant="ghost"
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
		<Form.Button class="w-full" type="submit">Save</Form.Button>
	</div>
</form>

<SuperDebug data={$formData} />

{#snippet SubFields(load_type: LoadType | undefined)}
	<div class="flex justify-between gap-1">
		<Form.Field {form} name="quantity" class="text-center">
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
		{#if load_type === 'CUSTOM'}
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
		{/if}
		{#if load_type === 'DEFAULT'}
			<Form.Field
				{form}
				name="load_description"
				class="mt-[0.42rem] flex w-full flex-col text-center"
			>
				<Popover.Root bind:open={open_load_description}>
					<Form.Control id={load_description_trigger_id}>
						{#snippet children({ props })}
							<Form.Label class="mb-[0.2rem]">Load description</Form.Label>
							<Popover.Trigger
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'justify-between',
									!$formData.load_description && 'text-muted-foreground'
								)}
								role="combobox"
								{...props}
							>
								{default_loads_description.find((s) => s.value === $formData.load_description)
									?.label ?? 'Select a load description'}
								<CaretSort class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<input hidden value={$formData.load_description} name={props.name} />
						{/snippet}
					</Form.Control>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search a load description..." class="h-9" />
							<Command.Empty>No load description found.</Command.Empty>
							<Command.Group>
								{#each default_loads_description as default_load}
									<Command.Item
										value={default_load.value}
										onSelect={() => {
											$formData.load_description = default_load.value;
											closeAndFocusTrigger(load_description_trigger_id);
										}}
									>
										{default_load.label}
										<Check
											class={cn(
												'ml-auto size-4',
												default_load.value !== $formData.load_description && 'text-transparent'
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
		{/if}
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
		<Form.Field {form} name="continuous" class="mt-1.5 grid text-center">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>Continuous</Form.Label>
					<Checkbox
						disabled={load_type === 'DEFAULT'}
						{...props}
						bind:checked={$formData.continuous}
						class="mx-auto mt-0"
					/>
					<input name={props.name} value={$formData.continuous} hidden class="sr-only" />
				{/snippet}
			</Form.Control>
		</Form.Field>
		<Form.Field
			{form}
			name="special"
			class={cn('text-center', {
				'mt-2 grid': load_type === 'CUSTOM'
			})}
		>
			{#if load_type === 'DEFAULT'}
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Special</Form.Label>
						<Input
							disabled={true}
							{...props}
							bind:value={$formData.special}
							placeholder="Enter a special"
						/>
					{/snippet}
				</Form.Control>
			{/if}
			{#if load_type === 'CUSTOM'}
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
			{/if}
			<Form.FieldErrors />
		</Form.Field>
	</div>
{/snippet}
