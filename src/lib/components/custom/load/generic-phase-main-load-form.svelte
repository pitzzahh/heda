<script lang="ts" module>
	interface Props {
		closeDialog: () => void;
		selected_parent_id?: string;
		node_to_edit?: Node;
		action: 'add' | 'edit';
		latest_circuit_node?: Node;
		panel_id_from_tree?: string;
	}

	type FormLoadTypeOption = 'DEFAULT' | 'CUSTOM';
</script>

<script lang="ts">
	import { CaretUpDownIcon, CheckIcon, WarningCircleIcon } from '#lib/assets/icons';
	import { scale } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { ScrollArea } from '#lib/components/ui/scroll-area/index.js';
	import { createForm, Field, getInput, setInput, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { useId } from 'bits-ui';
	import { tick } from 'svelte';
	import { cn } from '#lib/utils';
	import {
		DEFAULT_TERMINAL_TEMPERATURE_OPTIONS,
		DEFAULT_LOADS,
		DEFAULT_LOAD_TYPES_OPTIONS,
		load_type_to_varies_label,
		DEFAULT_HP_CURRENT_RELATIONSHIP_OPTIONS,
		default_hp_current_relationship,
		load_type_to_quantity_label
	} from '#lib/constants';
	import { GENERIC_PHASE_MAIN_LOAD_SCHEMA } from '#lib/validators/load';
	import type { GenericPhaseMainLoadSchema } from '#lib/types/load';
	import { page } from '$app/state';
	import { addNode, updateNode } from '#lib/db/mutations';
	import { checkNodeExists } from '#lib/db/queries';
	import { convertToNormalText } from '#lib/utils/text';
	import type { Node } from '#lib/types/db';
	import type { LoadType, QuantityLabel, TerminalTemperature, VariesLabel } from '#lib/types/load';
	import { formatFraction } from '#lib/utils/format';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte';

	let {
		closeDialog,
		node_to_edit,
		action,
		selected_parent_id,
		latest_circuit_node,
		panel_id_from_tree
	}: Props = $props();

	let undo_redo_state = getUndoRedoState();
	const db_revisions = getDbRevisionsState();
	let collapsibles = getCollapsiblesState();

	// Snapshot of props at mount: initial form values never track later prop changes.
	function buildInitialInput() {
		if (action !== 'edit')
			return { circuit_number: (latest_circuit_node?.circuit_number ?? 0) + 1 };
		if (!node_to_edit || !node_to_edit.load_data) {
			// TODO: Log system error
			toast.warning('Failed to identify the load to edit', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return {};
		}
		return {
			circuit_number: node_to_edit.circuit_number,
			load_description: node_to_edit.load_data.load_description.split(' - ')[1],
			terminal_temperature: node_to_edit.load_data.terminal_temperature as TerminalTemperature,
			load_type: node_to_edit.load_data.load_type as LoadType,
			quantity: node_to_edit.load_data.quantity,
			varies: node_to_edit.load_data.varies,
			continuous: node_to_edit.load_data.continuous,
			length: node_to_edit.length
		};
	}

	const form = createForm({
		schema: GENERIC_PHASE_MAIN_LOAD_SCHEMA,
		initialInput: buildInitialInput()
	});

	let taken_circuit_number = $state(0);
	let submitting = $state(false);
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

		if (panel_id_from_params || panel_id_from_tree) {
			taken_circuit_number = (await checkNodeExists({
				circuit_number: data.circuit_number,
				//we want to check if the circuit number is alrdy existing in the parent we want to move in
				parent_id: selected_parent_id || panel_id_from_tree || panel_id_from_params || '',
				node_id: node_to_edit?.id
			}))
				? data.circuit_number
				: 0;

			if (is_circuit_number_taken) {
				toast.warning('Circuit number already exists');
				submitting = false;
				return;
			}

			if (load_type) {
				const load_description = `${data.quantity} - ${data.load_description}`;
				const load_data = {
					...data,
					load_description,
					config_preference: load_type,

					// should only append when the load type is rated hp
					...(data.load_type === '1P Motor - Rated Horse Power' && {
						varies:
							default_hp_current_relationship[
								data.varies as keyof typeof default_hp_current_relationship
							]
					})
				} as GenericPhaseMainLoadSchema & { config_preference: 'CUSTOM' | 'DEFAULT' };
				switch (action) {
					case 'add': {
						const parent_id = panel_id_from_tree as string;
						const added_node = await addNode({
							load_data,
							parent_id
						});
						toast.success(`${load_description} added successfully`);
						collapsibles.addNodeId(parent_id);
						undo_redo_state.setActionToUndo({
							data: added_node as unknown as PhaseLoadSchedule,
							action: 'create_node'
						});
						break;
					}
					case 'edit':
						if (node_to_edit && selected_parent_id) {
							const updated_node = await updateNode({
								load_data,
								id: node_to_edit.id,
								parent_id: selected_parent_id
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
			db_revisions.bumpWorkspaceAndSchedule();
			closeDialog();
		}
		submitting = false;
	}

	const panel_id_from_params = page.params?.id?.split('_')?.at(-1) || ''; //gets the id of the parent node (panel) of the loads

	const variesLabel: VariesLabel | 'Varies' = $derived(
		getInput(form, { path: ['load_type'] })
			? load_type_to_varies_label[getInput(form, { path: ['load_type'] }) as LoadType]
			: 'Varies'
	);

	const quantity_label: QuantityLabel | 'QTY' = $derived(
		getInput(form, { path: ['load_type'] })
			? load_type_to_quantity_label[getInput(form, { path: ['load_type'] }) as LoadType]
			: 'QTY'
	);

	let open_horsepower_rating = $state(false);
	let open_terminal_temp = $state(false);
	let open_load_type = $state(false);
	let open_load_description = $state(false);
	let open_ambient_temp = $state(false);
	const terminal_temp_trigger_id = useId();
	const ambient_temp_trigger_id = useId();
	const load_type_trigger_id = useId();
	const load_description_trigger_id = useId();
	const horsepower_rating_trigger_id = useId();
	// Snapshot at mount: the DEFAULT/CUSTOM toggle never tracks later prop changes.
	function initialLoadType() {
		return node_to_edit?.load_data?.config_preference as FormLoadTypeOption | undefined;
	}
	let load_type = $state<FormLoadTypeOption | undefined>(initialLoadType());

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

	function selectDefaultLoad(description: string) {
		setInput(form, { path: ['load_description'], input: description });
		if (load_type === 'DEFAULT') {
			const selected_load = DEFAULT_LOADS.find((f) => f.description === description);
			if (!description || !selected_load) {
				// TODO: Log system error
				return toast.warning('Failed to identify the load description data', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}
			setInput(form, { path: ['varies'], input: selected_load.varies });
			setInput(form, { path: ['continuous'], input: selected_load.continuous });
			setInput(form, { path: ['load_type'], input: selected_load.type });
		}
		closeAndFocusTrigger(load_description_trigger_id);
	}
</script>

<form
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
	<div class="mt-2 grid grid-cols-2 place-items-start justify-between gap-2">
		<div class="flex flex-col gap-2.5">
			<Field of={form} path={['circuit_number']}>
				{#snippet children(field)}
					<div class="space-y-2">
						<Label class={cn({ 'text-destructive': is_circuit_number_taken })}>Circuit number</Label
						>
						<Input
							{...field.props}
							type="number"
							inputmode="numeric"
							min={1}
							class={cn({ 'border-destructive': is_circuit_number_taken })}
							value={field.input ?? ''}
							oninput={(e) => field.onInput(e.currentTarget.valueAsNumber)}
							placeholder="Enter the circuit number"
						/>
						<p class="text-muted-foreground text-[0.8rem]">
							This is the circuit number that will determine the circuit number of the wire to the
							main.
						</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
			<Field of={form} path={['ambient_temperature']}>
				{#snippet children(field)}
					<div class="flex flex-col space-y-2">
						<Popover.Root bind:open={open_ambient_temp}>
							<Label class={cn(field.errors && 'text-destructive')}>Ambient Temperature</Label>
							<Popover.Trigger
								id={ambient_temp_trigger_id}
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'justify-between',
									!field.input && 'text-muted-foreground'
								)}
								role="combobox"
							>
								{field.input ? field.input : 'Select an ambient temperature'}
								<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0">
								<Command.Root>
									<Command.Input autofocus placeholder="Search a terminal temp..." class="h-9" />
									<Command.Empty>No terminal temp found.</Command.Empty>
									<Command.Group>
										<ScrollArea class="h-64 pr-2.5">
											{#each [...Array.from({ length: 70 }, (_, i) => i + 1)] as ambient_temp (ambient_temp)}
												<Command.Item
													value={ambient_temp.toString()}
													onSelect={() => {
														field.onInput(ambient_temp);
														closeAndFocusTrigger(ambient_temp_trigger_id);
													}}
													disabled={ambient_temp !== 30}
												>
													{ambient_temp}
													<CheckIcon
														class={cn(
															'ml-auto size-4',
															ambient_temp !== field.input && 'text-transparent'
														)}
													/>
												</Command.Item>
											{/each}
										</ScrollArea>
									</Command.Group>
								</Command.Root>
							</Popover.Content>
						</Popover.Root>
						<p class="text-muted-foreground text-[0.8rem]">
							This is the ambient temp that will determine the ambient temp of the panel wire to the
							main.
						</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		</div>

		<div class="flex flex-col gap-2.5">
			<Field of={form} path={['terminal_temperature']}>
				{#snippet children(field)}
					<div class="flex flex-col space-y-2">
						<Popover.Root bind:open={open_terminal_temp}>
							<Label class={cn('mb-0.5', field.errors && 'text-destructive')}
								>Terminal Temperature</Label
							>
							<Popover.Trigger
								id={terminal_temp_trigger_id}
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'justify-between',
									!field.input && 'text-muted-foreground'
								)}
								role="combobox"
							>
								{field.input
									? convertToNormalText(
											DEFAULT_TERMINAL_TEMPERATURE_OPTIONS.find((f) => f === field.input)
										)
									: 'Select a terminal temperature'}
								<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0">
								<Command.Root>
									<Command.Input autofocus placeholder="Search a terminal temp..." class="h-9" />
									<Command.Empty>No terminal temp found.</Command.Empty>
									<Command.Group>
										{#each DEFAULT_TERMINAL_TEMPERATURE_OPTIONS as terminal_temp (terminal_temp)}
											<Command.Item
												value={terminal_temp}
												onSelect={() => {
													field.onInput(terminal_temp as TerminalTemperature);
													closeAndFocusTrigger(terminal_temp_trigger_id);
												}}
												disabled={terminal_temp !== 'Standard Temperature'}
											>
												{convertToNormalText(terminal_temp)}
												<CheckIcon
													class={cn(
														'ml-auto size-4',
														terminal_temp !== field.input && 'text-transparent'
													)}
												/>
											</Command.Item>
										{/each}
									</Command.Group>
								</Command.Root>
							</Popover.Content>
						</Popover.Root>
						<p class="text-muted-foreground text-[0.8rem]">
							This is the terminal temp that will determine the terminal temp of the wire to the
							main.
						</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>

			<Field of={form} path={['length']}>
				{#snippet children(field)}
					<div class="space-y-2">
						<Label class={cn(field.errors && 'text-destructive')}>Length</Label>
						<Input
							{...field.props}
							type="number"
							inputmode="numeric"
							min={1}
							value={field.input ?? ''}
							oninput={(e) => field.onInput(e.currentTarget.valueAsNumber)}
							placeholder="Enter the length"
						/>
						<p class="text-muted-foreground text-[0.8rem]">This is the length of the load</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
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
		<Button type="submit" class="w-full" loading={submitting}>Save</Button>
	</div>
</form>

{#snippet SubFields(load_type: FormLoadTypeOption | undefined)}
	<div class="flex justify-between gap-1">
		<Field of={form} path={['quantity']}>
			{#snippet children(field)}
				<div class="w-1/4 space-y-2 text-center">
					<Label class={cn(field.errors && 'text-destructive')}>
						{#if quantity_label == null}
							QTY
						{:else}
							{quantity_label}
						{/if}
					</Label>
					<Input
						{...field.props}
						type="number"
						min={1}
						inputmode="numeric"
						value={field.input ?? ''}
						oninput={(e) => field.onInput(e.currentTarget.valueAsNumber)}
						placeholder="Enter {convertToNormalText(quantity_label)}"
					/>
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
		{#if load_type === 'CUSTOM'}
			<Field of={form} path={['load_description']}>
				{#snippet children(field)}
					<div class="w-full space-y-2 text-center">
						<Label class={cn(field.errors && 'text-destructive')}>Load description</Label>
						<Input
							{...field.props}
							value={field.input ?? ''}
							placeholder="Enter load description"
						/>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		{/if}
		{#if load_type === 'DEFAULT'}
			<Field of={form} path={['load_description']}>
				{#snippet children(field)}
					<div class="mt-[0.42rem] flex w-full flex-col space-y-2 text-center">
						<Popover.Root bind:open={open_load_description}>
							<Label class={cn('mb-[0.2rem]', field.errors && 'text-destructive')}
								>Load description</Label
							>
							<Popover.Trigger
								id={load_description_trigger_id}
								class={cn(
									buttonVariants({ variant: 'outline' }),
									'justify-between',
									!field.input && 'text-muted-foreground'
								)}
								role="combobox"
							>
								{DEFAULT_LOADS.find((s) => s.description === field.input)?.description ??
									'Select a load description'}
								<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
							<Popover.Content class="w-auto p-0">
								<Command.Root>
									<Command.Input autofocus placeholder="Search a load description..." class="h-9" />
									<Command.Empty>No load description found.</Command.Empty>
									<Command.Group>
										<ScrollArea class="h-64 pr-2.5">
											{#each DEFAULT_LOADS as default_load (default_load.description)}
												<Command.Item
													value={default_load.description}
													onSelect={() => selectDefaultLoad(default_load.description)}
												>
													{default_load.description}
													<CheckIcon
														class={cn(
															'ml-auto size-4',
															default_load.description !== field.input && 'text-transparent'
														)}
													/>
												</Command.Item>
											{/each}
										</ScrollArea>
									</Command.Group>
								</Command.Root>
							</Popover.Content>
						</Popover.Root>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		{/if}
		<Field of={form} path={['varies']}>
			{#snippet children(field)}
				<div
					class={cn('mt-2 grid w-1/3 space-y-2 text-center', {
						'cursor-not-allowed': load_type === 'DEFAULT',
						'text-center': variesLabel === 'Varies'
					})}
				>
					{#if variesLabel === 'Horsepower Rating'}
						<Popover.Root bind:open={open_horsepower_rating}>
							<Label class={cn(field.errors && 'text-destructive')}>{variesLabel}</Label>
							<Popover.Trigger
								id={horsepower_rating_trigger_id}
								class={cn(
									buttonVariants({
										variant: 'outline',
										className: 'justify-between'
									}),
									!field.input && 'text-muted-foreground',
									{ 'cursor-not-allowed': load_type === 'DEFAULT' }
								)}
								disabled={load_type === 'DEFAULT'}
								role="combobox"
							>
								{@const varies_output =
									default_hp_current_relationship[
										field.input as keyof typeof default_hp_current_relationship
									]}
								{#if field.input}
									<p>
										<!-- eslint-disable-next-line svelte/no-at-html-tags -- formatFraction escapes input; only matched digits reach the markup -->
										{@html formatFraction(field.input)}
										({varies_output})
									</p>
								{:else}
									Select a {variesLabel.toLowerCase()}
								{/if}
								<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
							</Popover.Trigger>
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
											{#each DEFAULT_HP_CURRENT_RELATIONSHIP_OPTIONS as hp_current_rating (hp_current_rating)}
												<Command.Item
													value={hp_current_rating}
													onSelect={() => {
														field.onInput(hp_current_rating);
														closeAndFocusTrigger(horsepower_rating_trigger_id);
													}}
												>
													<!-- eslint-disable-next-line svelte/no-at-html-tags -- formatFraction escapes input; only matched digits reach the markup -->
													{@html formatFraction(hp_current_rating)}
													<CheckIcon
														class={cn(
															'ml-auto size-4',
															hp_current_rating !== field.input && 'text-transparent'
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
						<Label class={cn(field.errors && 'text-destructive')}>{variesLabel}</Label>
						<Input
							{...field.props}
							inputmode="numeric"
							readonly={load_type === 'DEFAULT'}
							min={1}
							class={cn('text-muted-foreground', { 'cursor-not-allowed': load_type === 'DEFAULT' })}
							value={field.input ?? ''}
							placeholder="Enter {variesLabel.toLowerCase()}"
						/>
					{/if}
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
		<Field of={form} path={['continuous']}>
			{#snippet children(field)}
				<div class="mt-[0.470rem] flex flex-col gap-2 space-y-2 text-center">
					<Label class={cn(field.errors && 'text-destructive')}>Continuous</Label>
					<Checkbox
						disabled={load_type === 'DEFAULT'}
						checked={field.input ?? false}
						onCheckedChange={(v) => field.onInput(v)}
						class="mx-auto mt-0"
					/>
				</div>
			{/snippet}
		</Field>
		<Field of={form} path={['load_type']}>
			{#snippet children(field)}
				<div
					class={cn('mt-2 grid space-y-2 text-center', {
						'cursor-not-allowed': load_type === 'DEFAULT'
					})}
				>
					<Popover.Root bind:open={open_load_type}>
						<Label class={cn(field.errors && 'text-destructive')}>Load type</Label>
						<Popover.Trigger
							id={load_type_trigger_id}
							class={cn(
								buttonVariants({
									variant: 'outline',
									className: 'justify-between'
								}),
								!field.input && 'text-muted-foreground',
								{ 'cursor-not-allowed': load_type === 'DEFAULT' }
							)}
							disabled={load_type === 'DEFAULT'}
							role="combobox"
						>
							{field.input
								? DEFAULT_LOAD_TYPES_OPTIONS.find((s) => s === field.input)
								: 'Select a load type'}
							<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
						</Popover.Trigger>
						<Popover.Content class="w-auto p-0">
							<Command.Root>
								<Command.Input autofocus placeholder="Search a load type..." class="h-9" />
								<Command.Empty>No load type found.</Command.Empty>
								<Command.Group>
									{#each DEFAULT_LOAD_TYPES_OPTIONS as load_type_option (load_type_option)}
										<Command.Item
											value={load_type_option}
											onSelect={() => {
												field.onInput(load_type_option as LoadType);
												closeAndFocusTrigger(load_type_trigger_id);
											}}
										>
											{load_type_option}
											<CheckIcon
												class={cn(
													'ml-auto size-4',
													load_type_option !== field.input && 'text-transparent'
												)}
											/>
										</Command.Item>
									{/each}
								</Command.Group>
							</Command.Root>
						</Popover.Content>
					</Popover.Root>
					<FieldErrors errors={field.errors} />
				</div>
			{/snippet}
		</Field>
	</div>
{/snippet}
