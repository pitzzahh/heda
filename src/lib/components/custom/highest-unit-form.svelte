<script module>
	import { z } from 'zod';

	const ambient_temperatures = [
		{ label: '60', value: '60' },
		{ label: '75', value: '75' },
		{ label: '90', value: '90' },
		{ label: 'temparature limitation', value: 'default' }
	] as const;

	type Temperature = (typeof ambient_temperatures)[number]['value'];

	export const unit_schema = z.object({
		id: z.string().optional(),
		distribution_unit: z.string().refine((v) => v, { message: 'A distribution unit is required.' }),
		ambient_temp: z.enum(
			ambient_temperatures.map((f) => f.value) as [Temperature, ...Temperature[]],
			{
				errorMap: () => ({ message: 'Please select a valid ambient temperature.' })
			}
		),
		phase_name: z.enum(['one_phase', 'three_phase_wye', 'three_phase_delta'], {
			required_error: 'You need to select a phase name'
		})
	});
	export type UnitSchema = z.infer<typeof unit_schema>;
</script>

<script lang="ts" generics="T extends SuperValidated<UnitSchema>">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import SuperDebug from 'sveltekit-superforms';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import * as RadioGroup from '@/components/ui/radio-group/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import { tick } from 'svelte';
	import { useId } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import { buttonVariants } from '@/components/ui/button';
	import { CaretSort, Check } from '@/assets/icons/radix';

	interface Props {
		higest_unit_form: T;
	}

	let { higest_unit_form }: Props = $props();

	const form = superForm(higest_unit_form, {
		SPA: true,
		validators: zodClient(unit_schema),
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
						<Input {...props} bind:value={$formData.distribution_unit} />
					{/snippet}
				</Form.Control>
				<Form.Description>This is the distribution unit</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
			<Form.Field {form} name="ambient_temp" class="flex flex-col">
				<Popover.Root bind:open={open_ambient_temp}>
					<Form.Control id={ambient_temp_trigger_id}>
						{#snippet children({ props })}
							<Form.Label>Ambient Temperature</Form.Label>
							<Popover.Trigger
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'w-[200px] justify-between',
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
					<Popover.Content class="w-[200px] p-0">
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
					This is the ambient temp that will determine the ambient temp of the wire from main to
					load.
				</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<div class="flex flex-col gap-1">
				<Form.Field {form} name="distribution_unit">
					<Form.Control>
						{#snippet children({ props })}
							<Form.Label>Distribution unit</Form.Label>
							<Input {...props} bind:value={$formData.distribution_unit} />
						{/snippet}
					</Form.Control>
					<Form.Description>This is the distribution unit</Form.Description>
					<Form.FieldErrors />
				</Form.Field>
			</div>
		</div>

		<Form.Fieldset {form} name="phase_name" class="space-y-3">
			<Form.Legend>Select a phase</Form.Legend>
			<RadioGroup.Root
				bind:value={$formData.phase_name}
				class="flex flex-col space-y-1"
				name="phase_name"
			>
				<div class="flex items-center space-x-3 space-y-0">
					<Form.Control>
						{#snippet children({ props })}
							<RadioGroup.Item value="all" {...props} />
							<Form.Label class="font-normal">1 Phase</Form.Label>
						{/snippet}
					</Form.Control>
				</div>
				<div class="flex items-center space-x-3 space-y-0">
					<Form.Control>
						{#snippet children({ props })}
							<RadioGroup.Item value="mentions" {...props} />
							<Form.Label class="font-normal">3 Phase Wye</Form.Label>
						{/snippet}
					</Form.Control>
				</div>
				<div class="flex items-center space-x-3 space-y-0">
					<Form.Control>
						{#snippet children({ props })}
							<RadioGroup.Item value="none" {...props} />
							<Form.Label class="font-normal">3 Phase Delta</Form.Label>
						{/snippet}
					</Form.Control>
				</div>
			</RadioGroup.Root>
			<Form.FieldErrors />
		</Form.Fieldset>
		<Form.Button class="w-full">Proceed</Form.Button>
	</div>
</form>

{#if dev}
	<SuperDebug data={$formData} />
{/if}
