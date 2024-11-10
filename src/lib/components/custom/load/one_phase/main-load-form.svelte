<script module>
	import { z } from 'zod';

	export const one_main_load_schema = z.object({
		circuit_number: z.string().refine((v) => v, { message: 'A circuit number is required.' }),
		ambient_temperature: z
			.string()
			.refine((v) => v, { message: 'An ambient temperature is required.' }),
		phase_name: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
			required_error: 'You need to select a phase name'
		})
	});
	export type OneMainLoadSchema = z.infer<typeof one_main_load_schema>;
</script>

<script lang="ts" generics="T extends SuperValidated<OneMainLoadSchema>">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import SuperDebug from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import { Separator } from '@/components/ui/separator/index.js';
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';
	import { cn } from '@/utils';
	import { CaretSort, Check } from '@/assets/icons/radix';
	import { type HighestUnitSchema, highest_unit_schema } from '@/schema';
	import { ambient_temperatures } from '@/constants';
	import type { LoadType } from '@/types/load';

	interface Props {
		new_file_form: T;
		saved_path?: string;
	}

	let { new_file_form, saved_path = 'Documents' }: Props = $props();

	const form = superForm(new_file_form, {
		SPA: true,
		validators: zodClient(one_main_load_schema),
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
	let load_type = $state<LoadType | undefined>();

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
	<Form.Field {form} name="circuit_number">
		<Form.Control>
			{#snippet children({ props })}
				<Form.Label>Circuit number</Form.Label>
				<Input {...props} bind:value={$formData.circuit_number} />
			{/snippet}
		</Form.Control>
		<Form.Description>This is the main load name</Form.Description>
		<Form.FieldErrors />
	</Form.Field>
	<Form.Field {form} name="ambient_temperature" class="col-span-2 flex flex-col">
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
						{ambient_temperatures.find((f) => f.value === $formData.ambient_temperature)?.label ??
							'Select an ambient temperature'}
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
			This is the ambient temp that will determine the ambient temp of the wire to the main.
		</Form.Description>
		<Form.FieldErrors />
	</Form.Field>

	{#if !load_type}
		<div class="items-center-justify-between flex gap-2">
			<Button onclick={()=> load_type = 'DEFAULT'}>Default</Button>
			<Button onclick={()=> load_type = 'CUSTOM'}>Custom</Button>
		</div>
	{/if}
	{#if load_type === 'DEFAULT'}
	DEFAULT LOAD FORM
	{/if}
	{#if load_type === 'CUSTOM'}
		CUSTOM LOAD FORM
	{/if}
	<Form.Button class="w-full">Save</Form.Button>
</form>

{#if dev}
	<SuperDebug data={$formData} />
{/if}
