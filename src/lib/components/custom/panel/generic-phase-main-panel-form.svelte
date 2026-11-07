<script lang="ts" module>
	interface Props {
		main_phase: Phase;
		parent_id?: string;
		closeDialog: () => void;
		node_to_edit?: Node;
		action: 'add' | 'edit';
		selected_parent_id?: string;
		latest_circuit_node?: Node;
	}
</script>

<script lang="ts">
	import { CaretUpDownIcon, CheckIcon, WarningCircleIcon } from '#lib/assets/icons';
	import { createForm, Field, getInput, validate } from '@formisch/svelte';
	import { toast } from 'svelte-sonner';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.js';
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
		DEFAULT_PHASES_OPTIONS,
		DEFAULT_THREE_PHASE_TYPES_OPTIONS
	} from '#lib/constants';
	import { GENERIC_PHASE_PANEL_SCHEMA } from '#lib/validators/panel';
	import type { Phase } from '#lib/types/phase';
	import { convertToNormalText } from '#lib/utils/text';
	import { addNode, updateNode } from '#lib/db/mutations';
	import { checkNodeExists } from '#lib/db/queries';
	import type { Node } from '#lib/types/db';
	import type { TerminalTemperature } from '#lib/types/load';
	import ScrollArea from '#lib/components/ui/scroll-area/scroll-area.svelte';
	import { getUndoRedoState } from '#lib/hooks/undo-redo.svelte';
	import { getDbRevisionsState } from '#lib/hooks/db-revisions.svelte';
	import type { PhaseLoadSchedule } from '#lib/types/load/one_phase';
	import { getCollapsiblesState } from '#lib/hooks/node-collapsibles.svelte';

	let {
		main_phase,
		parent_id,
		closeDialog,
		node_to_edit,
		action,
		latest_circuit_node,
		selected_parent_id
	}: Props = $props();

	let undo_redo_state = getUndoRedoState();
	const db_revisions = getDbRevisionsState();
	let collapsibles = getCollapsiblesState();

	// Snapshot of props at mount: initial form values never track later prop changes.
	function buildInitialInput() {
		if (action !== 'edit')
			// A 1P supply can only feed 1P panels: preselect it since the trigger is locked.
			return {
				circuit_number: (latest_circuit_node?.circuit_number ?? 0) + 1,
				...(main_phase === '1P' ? { phase: '1P' as Phase } : {})
			};
		if (!node_to_edit || !node_to_edit.panel_data) {
			// TODO: Log system error
			toast.warning('Failed to identify the panel to edit', {
				description: 'This is a system error and should not be here, the error has been logged.'
			});
			return {};
		}
		return {
			circuit_number: node_to_edit.circuit_number,
			name: node_to_edit.panel_data.name ?? 'Unknown',
			terminal_temperature: node_to_edit.panel_data.terminal_temperature as TerminalTemperature,
			phase: node_to_edit.panel_data.phase as Phase,
			ambient_temperature: node_to_edit.panel_data.ambient_temperature,
			length: node_to_edit.length
		};
	}

	const form = createForm({
		schema: GENERIC_PHASE_PANEL_SCHEMA,
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

		if (parent_id) {
			taken_circuit_number = (await checkNodeExists({
				circuit_number: data.circuit_number,
				//we want to check if the circuit number is alrdy existing in the parent we want to move in
				parent_id: selected_parent_id || parent_id,
				node_id: node_to_edit?.id
			}))
				? data.circuit_number
				: 0;

			if (is_circuit_number_taken) {
				toast.warning('Circuit number already exists');
				submitting = false;
				return;
			}

			switch (action) {
				case 'add': {
					const added_node = await addNode({ parent_id, panel_data: data });
					toast.success(`${data.name} added successfully`);
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
							panel_data: data,
							id: node_to_edit.id,
							parent_id: selected_parent_id
						});
						toast.success('Panel updated successfully');
						undo_redo_state.setActionToUndo({
							data: updated_node as unknown as PhaseLoadSchedule,
							previous_data: node_to_edit as PhaseLoadSchedule,
							action: 'update_node'
						});
					}
					break;
			}

			db_revisions.bumpWorkspaceAndSchedule();
			closeDialog();
		}
		submitting = false;
	}

	let open_panel_phase_popover = $state(false);
	let open_terminal_temp = $state(false);
	let open_phase_type = $state(false);
	let open_ambient_temp = $state(false);

	const phase_trigger_id = useId();
	const panel_phase_type_trigger_id = useId();
	const terminal_temp_trigger_id = useId();
	const ambient_temp_trigger_id = useId();

	// We want to refocus the trigger button when the user selects
	// an item from the list so users can continue navigating the
	// rest of the form with the keyboard.
	function closeAndFocusTrigger(trigger_id: string) {
		open_terminal_temp = false;
		open_panel_phase_popover = false;
		open_phase_type = false;
		open_ambient_temp = false;
		tick().then(() => {
			document.getElementById(trigger_id)?.focus();
		});
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
	<div class="grid grid-cols-2 gap-2">
		<div class="flex flex-col gap-2.5">
			<Field of={form} path={['name']}>
				{#snippet children(field)}
					<div class="space-y-2">
						<Label class={cn(field.errors && 'text-destructive')}>Name</Label>
						<Input {...field.props} value={field.input ?? ''} placeholder="Enter panel name" />
						<p class="text-muted-foreground text-[0.8rem]">This is the panel name.</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
			<Field of={form} path={['circuit_number']}>
				{#snippet children(field)}
					<div class="space-y-2">
						<Label class={cn(field.errors && 'text-destructive')}>Circuit number</Label>
						<Input
							{...field.props}
							type="number"
							inputmode="numeric"
							min={1}
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
			<Field of={form} path={['terminal_temperature']}>
				{#snippet children(field)}
					<div class="flex flex-col space-y-2">
						<Popover.Root bind:open={open_terminal_temp}>
							<Label class={cn(field.errors && 'text-destructive')}>Terminal Temperature</Label>
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
							This is the terminal temp that will determine the terminal temp of the panel wire to
							the main.
						</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		</div>

		<div class="flex flex-col gap-2.5">
			{#if main_phase !== '1P'}
				{@render PanelType()}
				{@render PanelPhase()}
			{:else}
				{@render PanelPhase()}
			{/if}
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

			<Field of={form} path={['length']}>
				{#snippet children(field)}
					<div class="flex flex-col space-y-2">
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
						<p class="text-muted-foreground text-[0.8rem]">This is the length of the panel</p>
						<FieldErrors errors={field.errors} />
					</div>
				{/snippet}
			</Field>
		</div>
	</div>
	<Button type="submit" class="w-full" loading={submitting}>Save</Button>
</form>

{#snippet PanelType()}
	<Field of={form} path={['type']}>
		{#snippet children(field)}
			<div class="flex flex-col space-y-2">
				<Popover.Root bind:open={open_phase_type}>
					<Label class={cn(field.errors && 'text-destructive')}>Type</Label>
					<Popover.Trigger
						id="phase_trigger_id"
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'justify-between',
							!field.input && 'text-muted-foreground'
						)}
						role="combobox"
					>
						{field.input
							? convertToNormalText(
									DEFAULT_THREE_PHASE_TYPES_OPTIONS.find((f) => f === field.input)
								)
							: 'Select a panel phase type'}
						<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search panel phase type..." class="h-9" />
							<Command.Empty>No panel phase type found.</Command.Empty>
							<Command.Group>
								{#each DEFAULT_THREE_PHASE_TYPES_OPTIONS as phase_type_option (phase_type_option)}
									<Command.Item
										value={phase_type_option}
										onSelect={() => {
											field.onInput(phase_type_option as 'WYE' | 'DELTA' | 'ALGO');
											closeAndFocusTrigger(panel_phase_type_trigger_id);
										}}
									>
										{convertToNormalText(phase_type_option)}
										<CheckIcon
											class={cn(
												'ml-auto size-4',
												phase_type_option !== field.input && 'text-transparent'
											)}
										/>
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<p class="text-muted-foreground text-[0.8rem]">This is the type for the panel.</p>
				<FieldErrors errors={field.errors} />
			</div>
		{/snippet}
	</Field>
{/snippet}

{#snippet PanelPhase()}
	{@const is_one_phase = main_phase === '1P'}
	<Field of={form} path={['phase']}>
		{#snippet children(field)}
			<div
				class={cn('flex flex-col space-y-2', {
					'cursor-not-allowed': is_one_phase
				})}
			>
				<Popover.Root bind:open={open_panel_phase_popover}>
					<Label class={cn(field.errors && 'text-destructive')}>Phase</Label>
					<Popover.Trigger
						id="panel_phase_trigger_id"
						disabled={is_one_phase}
						class={cn(
							buttonVariants({ variant: 'outline' }),
							'justify-between',
							!field.input && 'text-muted-foreground'
						)}
						role="combobox"
					>
						{field.input ? DEFAULT_PHASES_OPTIONS.find((f) => f === field.input) : 'Select a phase'}
						<CaretUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
					</Popover.Trigger>
					<Popover.Content class="w-auto p-0">
						<Command.Root>
							<Command.Input autofocus placeholder="Search a panel phase..." class="h-9" />
							<Command.Empty>No panel phase found.</Command.Empty>
							<Command.Group>
								{#each DEFAULT_PHASES_OPTIONS as phase_option (phase_option)}
									<Command.Item
										value={phase_option}
										onSelect={() => {
											field.onInput(phase_option as Phase);
											closeAndFocusTrigger(phase_trigger_id);
										}}
									>
										{phase_option}
										<CheckIcon
											class={cn(
												'ml-auto size-4',
												phase_option !== field.input && 'text-transparent'
											)}
										/>
									</Command.Item>
								{/each}
							</Command.Group>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
				<p class="text-muted-foreground text-[0.8rem]">This is the phase for the panel.</p>
				<FieldErrors errors={field.errors} />
			</div>
		{/snippet}
	</Field>
{/snippet}
