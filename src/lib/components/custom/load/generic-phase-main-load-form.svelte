<script lang="ts" generics="T extends SuperValidated<GenericPhaseMainLoadSchema>">
	import { scale } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { Separator } from '@/components/ui/separator/index.js';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { toast } from 'svelte-sonner';
	import { Input } from '@/components/ui/input/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import { Checkbox } from '@/components/ui/checkbox/index.js';
	import * as Popover from '@/components/ui/popover/index.js';
	import * as Command from '@/components/ui/command/index.js';
	import * as Alert from '@/components/ui/alert/index.js';
	import * as Form from '@/components/ui/form/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';
	import { cn } from '@/utils';
	import { ChevronsUpDown, CircleAlert, Check } from '@/assets/icons';
	import {
		DEFAULT_TERMINAL_TEMPERATURE_OPTIONS,
		DEFAULT_LOADS,
		DEFAULT_LOAD_TYPES_OPTIONS,
		load_type_to_varies_label,
		DEFAULT_HP_CURRENT_RELATIONSHIP_OPTIONS,
		default_hp_current_relationship,
		load_type_to_quantity_label
	} from '@/constants';
	import { generic_phase_main_load_schema, type GenericPhaseMainLoadSchema } from '@/schema/load';
	import { page } from '$app/state';
	import { addNode, updateNode } from '@/db/mutations';
	import { checkNodeExists } from '@/db/queries';
	import { invalidate } from '$app/navigation';
	import { convertToNormalText } from '@/utils/text';
	import type { Node } from '@/db/schema';
	import type { LoadType, QuantityLabel, TerminalTemperature, VariesLabel } from '@/types/load';
	import { formatFraction } from '@/utils/format';
	import { getUndoRedoState } from '@/hooks/undo-redo.svelte';
	import type { PhaseLoadSchedule } from '@/types/load/one_phase';
	import { getCollapsiblesState } from '@/hooks/node-collapsibles.svelte';
	import { getProjectState } from '@/hooks/project-state.svelte';

	interface Props {
		phase_main_load_form: T;
		closeDialog: () => void;
		selected_parent_id?: string;
		node_to_edit?: Node;
		action: 'add' | 'edit';
		latest_circuit_node?: Node;
		panel_id_from_tree?: string;
	}

	type FormLoadTypeOption = 'DEFAULT' | 'CUSTOM';

	let {
		phase_main_load_form,
		closeDialog,
		node_to_edit,
		action,
		selected_parent_id,
		latest_circuit_node,
		panel_id_from_tree
	}: Props = $props();

	let undo_redo_state = getUndoRedoState();
	let collapsibles = getCollapsiblesState();
	const project_state = getProjectState();

	const form = superForm(phase_main_load_form, {
		SPA: true,
		validators: zodClient(generic_phase_main_load_schema),
		onChange(event) {
			is_circuit_number_taken_state = {
				is_circuit_number_taken: false,
				circuit_number: 0
			};
			const { get, paths } = event;
			if (load_type === 'DEFAULT') {
				if (paths.includes('load_description') && paths.length === 1) {
					const selected_load_description = get('load_description');
					const selected_load = DEFAULT_LOADS.find(
						(f) => f.description === selected_load_description
					);
					if (!selected_load_description || !selected_load) {
						// TODO: Log system error
						return toast.warning('Failed to identify the load description data', {
							description:
								'This is a system error and should not be here, the error has been logged.'
						});
					}
					$formData.varies = selected_load.varies;
					$formData.continuous = selected_load.continuous;
					$formData.load_type = selected_load.type;
				}
			}
		},
		onUpdate: async ({ form, cancel }) => {
			if (!form.valid) {
				toast.error('Form is invalid');
				return;
			}

			if (panel_id_from_params || panel_id_from_tree) {
				is_circuit_number_taken_state.is_circuit_number_taken = await checkNodeExists({
					circuit_number: form.data.circuit_number,
					//we want to check if the circuit number is alrdy existing in the parent we want to move in
					parent_id: selected_parent_id || panel_id_from_tree || panel_id_from_params || '',
					node_id: node_to_edit?.id,
					instance_name: project_state.current_project_name
				});

				if (is_circuit_number_taken_state.is_circuit_number_taken) {
					cancel();
					toast.warning('Circuit number already exists');
					is_circuit_number_taken_state.circuit_number = form.data.circuit_number;
					return;
				}

				if (load_type) {
					const load_description = `${form.data.quantity} - ${form.data.load_description}`;
					const load_data = {
						...form.data,
						load_description,
						config_preference: load_type,

						// should only append when the load type is rated hp
						...(form.data.load_type === '1P Motor - Rated Horse Power' && {
							varies:
								default_hp_current_relationship[
									$formData.varies as keyof typeof default_hp_current_relationship
								]
						})
					} as GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
					switch (action) {
						case 'add':
							const parent_id = panel_id_from_tree as string;
							const added_node = await addNode({
								load_data,
								parent_id,
								instance_name: project_state.current_project_name
							});
							toast.success(`${load_description} added successfully`);
							collapsibles.addNodeId(parent_id);
							undo_redo_state.setActionToUndo({
								data: added_node as unknown as PhaseLoadSchedule,
								action: 'create_node'
							});
							break;
						case 'edit':
							if (node_to_edit && selected_parent_id) {
								const updated_node = await updateNode({
									load_data,
									id: node_to_edit.id,
									parent_id: selected_parent_id,
									instance_name: project_state.current_project_name
								});
								undo_redo_state.setActionToUndo({
									action: 'update_node',
									data: updated_node as unknown as PhaseLoadSchedule,
									previous_data: node_to_edit as PhaseLoadSchedule
								});
								toast.success('Load updated successfully');
							}
							break;
					}
				}
				invalidate('app:workspace').then(() => invalidate('app:workspace/load-schedule'));
				closeDialog();
			}
		}
	});
	const { form: formData, enhance } = form;

	const panel_id_from_params = page.params?.id?.split('_')?.at(-1) || ''; //gets the id of the parent node (panel) of the loads

	const variesLabel: VariesLabel | 'Varies' = $derived(
		$formData.load_type ? load_type_to_varies_label[$formData.load_type] : 'Varies'
	);

	const quantity_label: QuantityLabel | 'QTY' = $derived(
		$formData.load_type ? load_type_to_quantity_label[$formData.load_type] : 'QTY'
	);

	let open_horsepower_rating = $state(false);
	let open_terminal_temp = $state(false);
	let open_load_type = $state(false);
	let open_load_description = $state(false);
	let open_ambient_temp = $state(false);
	let is_circuit_number_taken_state = $state({
		is_circuit_number_taken: false,
		circuit_number: 0
	});
	const terminal_temp_trigger_id = useId();
	const ambient_temp_trigger_id = useId();
	const load_type_trigger_id = useId();
	const load_description_trigger_id = useId();
	const horsepower_rating_trigger_id = useId();
	let load_type = $state<FormLoadTypeOption | undefined>(
		node_to_edit?.load_data?.config_preference as FormLoadTypeOption | undefined
	);

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_horsepower_rating = false;
		open_terminal_temp = false;
		open_load_type = false;
		open_load_description = false;
		open_ambient_temp = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
	}

	$effect(() => {
		if (action !== 'edit') {
			$formData.circuit_number = (latest_circuit_node?.circuit_number ?? 0) + 1;
			return;
		}

		if (!node_to_edit || !node_to_edit.load_data) {
			// TODO: Log system error
			toast.warning('Failed to identify the load to edit', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return;
		}

		const {
			circuit_number,
			length,
			load_data: { load_description, terminal_temperature, load_type, quantity, varies, continuous }
		} = node_to_edit;

		$formData.circuit_number = circuit_number as number;
		$formData.load_description = load_description.split(' - ')[1];
		$formData.terminal_temperature = terminal_temperature as TerminalTemperature;
		$formData.load_type = load_type as LoadType;
		$formData.quantity = quantity;
		$formData.varies = varies;
		$formData.continuous = continuous;
		$formData.length = length as number;
	});
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
	<div class="mt-2 grid grid-cols-2 place-items-start justify-between gap-2">
		<div>
			<Form.Field {form} name="circuit_number">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label
							class={cn({ 'text-red': is_circuit_number_taken_state.is_circuit_number_taken })}
							>Circuit number</Form.Label
						>
						<Input
							{...props}
							type="number"
							inputmode="numeric"
							min={1}
							class={cn({ 'border-red': is_circuit_number_taken_state.is_circuit_number_taken })}
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
								{$formData.ambient_temperature
									? $formData.ambient_temperature
									: 'Select an ambient temperature'}
								<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<input hidden value={$formData.ambient_temperature} name={props.name} />
						{/snippet}
					</Form.Control>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search a terminal temp..." class="h-9" />
							<Command.Empty>No terminal temp found.</Command.Empty>
							<Command.Group>
								<ScrollArea class="h-64 pr-2.5">
									{#each [...Array.from({ length: 70 }, (_, i) => i + 1)] as ambient_temp}
										<Command.Item
											value={ambient_temp.toString()}
											onSelect={() => {
												$formData.ambient_temperature = ambient_temp;
												closeAndFocusTrigger(ambient_temp_trigger_id);
											}}
											disabled={ambient_temp !== 30}
										>
											{ambient_temp}
											<Check
												class={cn(
													'ml-auto size-4',
													ambient_temp !== $formData.ambient_temperature && 'text-transparent'
												)}
											/>
										</Command.Item>
									{/each}
								</ScrollArea>
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

		<div>
			<Form.Field {form} name="terminal_temperature" class="mt-2 flex flex-col">
				<Popover.Root bind:open={open_terminal_temp}>
					<Form.Control id={terminal_temp_trigger_id}>
						{#snippet children({ props })}
							<Form.Label class="mb-0.5">Terminal Temperature</Form.Label>
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
								{#each DEFAULT_TERMINAL_TEMPERATURE_OPTIONS as terminal_temp}
									<Command.Item
										value={terminal_temp}
										onSelect={() => {
											$formData.terminal_temperature = terminal_temp;
											closeAndFocusTrigger(terminal_temp_trigger_id);
										}}
										disabled={terminal_temp !== 'Standard Temperature'}
									>
										{convertToNormalText(terminal_temp)}
										<Check
											class={cn(
												'ml-auto size-4',
												terminal_temp !== $formData.terminal_temperature && 'text-transparent'
											)}
										/>
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<Form.Description>
					This is the terminal temp that will determine the terminal temp of the wire to the main.
				</Form.Description>
				<Form.FieldErrors />
			</Form.Field>

			<Form.Field {form} name="length">
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>Length</Form.Label>
						<Input
							{...props}
							type="number"
							inputmode="numeric"
							min={1}
							bind:value={$formData.length}
							placeholder="Enter the length"
						/>
					{/snippet}
				</Form.Control>
				<Form.Description>This is the length of the load</Form.Description>
				<Form.FieldErrors />
			</Form.Field>
		</div>
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

{#snippet SubFields(load_type: FormLoadTypeOption | undefined)}
	<div class="flex justify-between gap-1">
		<Form.Field {form} name="quantity" class="w-1/4 text-center">
			<Form.Control>
				{#snippet children({ props })}
					<Form.Label>{quantity_label ?? 'QTY'}</Form.Label>
					<Input
						{...props}
						type="number"
						min={1}
						inputmode="numeric"
						bind:value={$formData.quantity}
						placeholder="Enter {convertToNormalText(quantity_label)}"
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
								{DEFAULT_LOADS.find((s) => s.description === $formData.load_description)
									?.description ?? 'Select a load description'}
								<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<input hidden value={$formData.load_description} name={props.name} />
						{/snippet}
					</Form.Control>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search a load description..." class="h-9" />
							<Command.Empty>No load description found.</Command.Empty>
							<Command.Group>
								<ScrollArea class="h-64 pr-2.5">
									{#each DEFAULT_LOADS as default_load}
										<Command.Item
											value={default_load.description}
											onSelect={() => {
												$formData.load_description = default_load.description;
												closeAndFocusTrigger(load_description_trigger_id);
											}}
										>
											{default_load.description}
											<Check
												class={cn(
													'ml-auto size-4',
													default_load.description !== $formData.load_description &&
														'text-transparent'
												)}
											/>
										</Command.Item>
									{/each}
								</ScrollArea>
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<Form.FieldErrors />
			</Form.Field>
		{/if}
		<Form.Field
			{form}
			name="varies"
			class={cn('mt-2 grid w-1/3 text-center', {
				'cursor-not-allowed': load_type === 'DEFAULT',
				'text-center': variesLabel === 'Varies'
			})}
		>
			{#if variesLabel === 'Horsepower Rating'}
				<Popover.Root bind:open={open_horsepower_rating}>
					<Form.Control id={horsepower_rating_trigger_id}>
						{#snippet children({ props })}
							<Form.Label>{variesLabel}</Form.Label>
							<Popover.Trigger
								class={cn(
									buttonVariants({
										variant: 'outline',
										className: 'justify-between'
									}),
									!$formData.varies && 'text-muted-foreground',
									{ 'cursor-not-allowed': load_type === 'DEFAULT' }
								)}
								disabled={load_type === 'DEFAULT'}
								role="combobox"
								{...props}
							>
								{@const varies_output =
									default_hp_current_relationship[
										$formData.varies as keyof typeof default_hp_current_relationship
									]}
								{#if $formData.varies}
									<p>
										{@html formatFraction($formData.varies)}
										({varies_output})
									</p>
								{:else}
									Select a {variesLabel.toLowerCase()}
								{/if}
								<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<input hidden value={$formData.varies} name={props.name} />
						{/snippet}
					</Form.Control>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input
								autofocus
								placeholder="Search a {variesLabel.toLowerCase()}..."
								class="h-9"
							/>
							<Command.Empty>No {variesLabel.toLowerCase()} found.</Command.Empty>
							<Command.Group>
								<ScrollArea class="h-64 pr-2.5">
									{#each DEFAULT_HP_CURRENT_RELATIONSHIP_OPTIONS as hp_current_rating}
										<Command.Item
											value={hp_current_rating}
											onSelect={() => {
												$formData.varies = hp_current_rating;
												closeAndFocusTrigger(horsepower_rating_trigger_id);
											}}
										>
											{@html formatFraction(hp_current_rating)}
											<Check
												class={cn(
													'ml-auto size-4',
													hp_current_rating !== $formData.varies && 'text-transparent'
												)}
											/>
										</Command.Item>
									{/each}
								</ScrollArea>
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
			{:else}
				<Form.Control>
					{#snippet children({ props })}
						<Form.Label>{variesLabel}</Form.Label>
						<Input
							{...props}
							inputmode="numeric"
							readonly={load_type === 'DEFAULT'}
							min={1}
							class={cn('text-muted-foreground', { 'cursor-not-allowed': load_type === 'DEFAULT' })}
							bind:value={$formData.varies}
							placeholder="Enter {variesLabel.toLowerCase()}"
						/>
					{/snippet}
				</Form.Control>
			{/if}
			<Form.FieldErrors />
		</Form.Field>
		<Form.Field {form} name="continuous" class="mt-[0.470rem] flex flex-col gap-2 text-center">
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
			name="load_type"
			class={cn('mt-2 grid text-center', { 'cursor-not-allowed': load_type === 'DEFAULT' })}
		>
			<Popover.Root bind:open={open_load_type}>
				<Form.Control id={load_type_trigger_id}>
					{#snippet children({ props })}
						<Form.Label>Load type</Form.Label>
						<Popover.Trigger
							class={cn(
								buttonVariants({
									variant: 'outline',
									className: 'justify-between'
								}),
								!$formData.load_type && 'text-muted-foreground',
								{ 'cursor-not-allowed': load_type === 'DEFAULT' }
							)}
							disabled={load_type === 'DEFAULT'}
							role="combobox"
							{...props}
						>
							{$formData.load_type
								? DEFAULT_LOAD_TYPES_OPTIONS.find((s) => s === $formData.load_type)
								: 'Select a load type'}
							<ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
						</Popover.Trigger>
						<input hidden value={$formData.load_type} name={props.name} />
					{/snippet}
				</Form.Control>
				<Popover.Content class="w-auto p-0">
					<Command.Root>
						<Command.Input autofocus placeholder="Search a load type..." class="h-9" />
						<Command.Empty>No load type found.</Command.Empty>
						<Command.Group>
							{#each DEFAULT_LOAD_TYPES_OPTIONS as load_type}
								<Command.Item
									value={load_type}
									onSelect={() => {
										$formData.load_type = load_type;
										closeAndFocusTrigger(load_type_trigger_id);
									}}
								>
									{load_type}
									<Check
										class={cn(
											'ml-auto size-4',
											load_type !== $formData.load_type && 'text-transparent'
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
